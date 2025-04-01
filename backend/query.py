import os
import json
from typing import List, Dict, Any, Optional
import numpy as np

from langchain_community.chat_models import ChatOllama
from langchain.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document
from langchain.retrievers.multi_query import MultiQueryRetriever
from get_vector_db import get_vector_db
from db_utils import get_db_connection

# 使用环境变量配置
LLM_MODEL = os.getenv('LLM_MODEL', 'deepseek-r1:1.5B')
DB_PATH = os.getenv('DB_PATH', './documents.db')

def get_prompt() -> tuple:
    """
    创建查询和回答的提示模板
    
    返回:
        tuple: 包含查询提示模板和回答提示模板的元组
    """
    # 多重查询提示模板 - 使用英文提示以提高性能
    query_prompt = PromptTemplate(
        input_variables=["question"],
        template="""You are an AI assistant. Your task is to generate five different versions 
        of the user's question to help retrieve relevant information from a vector database.
        By generating multiple perspectives of the question, you can help overcome some limitations
        of distance-based similarity search. Provide these alternative questions separated by line breaks.
        
        Original question: {question}""",
    )

    # 回答提示模板 - 使用英文提示并确保不输出内部思考过程
    answer_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. Your task is to answer the question based on the context below.
                                                      Provide a direct, concise answer.
    
    Context:
    {context}
    
    Question: {question}
    
    Please provide a clear, professional answer with the language of the question:
    """)

    return query_prompt, answer_prompt

def get_document_metadata(doc_source: str) -> Optional[str]:
    """
    从数据库中获取文档的原始文件名
    
    参数:
        doc_source: 文档源路径
        
    返回:
        str: 原始文件名或None
    """
    if not doc_source:
        return None
        
    source_file = os.path.basename(doc_source)
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT original_filename FROM documents WHERE stored_filename = ?", 
            (source_file,)
        )
        result = cursor.fetchone()
        if result:
            return result[0]
        return source_file
    except Exception as e:
        print(f"获取文档元数据时出错: {str(e)}")
        return source_file
    finally:
        conn.close()

def calculate_relevance_score(query_embedding, doc_embedding):
    """
    计算查询和文档嵌入之间的相似度分数
    
    参数:
        query_embedding: 查询的嵌入向量
        doc_embedding: 文档的嵌入向量
        
    返回:
        float: 相似度分数 (0-100)
    """
    # 使用余弦相似度计算相关性
    dot_product = np.dot(query_embedding, doc_embedding)
    query_norm = np.linalg.norm(query_embedding)
    doc_norm = np.linalg.norm(doc_embedding)
    
    if query_norm == 0 or doc_norm == 0:
        return 0
    
    cosine_similarity = dot_product / (query_norm * doc_norm)
    # 将相似度转换为百分比分数
    return float(max(0, min(100, (cosine_similarity + 1) * 50)))

def format_sources(retrieved_docs: List[Document], query_embedding=None, doc_embeddings=None) -> List[Dict[str, Any]]:
    """
    格式化检索到的文档源信息，并包含相关度分数
    
    参数:
        retrieved_docs: 检索到的文档列表
        query_embedding: 查询的嵌入向量 (可选)
        doc_embeddings: 文档的嵌入向量 (可选)
        
    返回:
        List[Dict[str, Any]]: 格式化后的源信息列表
    """
    sources = []
    
    # 获取数据库连接
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    for i, doc in enumerate(retrieved_docs):
        # 提取文档内容
        content = doc.page_content
        
        # 获取文档元数据
        metadata = doc.metadata
        source_path = metadata.get('source') if metadata else None
        
        # 检查文档是否存在于数据库中
        if source_path:
            source_file = os.path.basename(source_path)
            cursor.execute(
                "SELECT id, original_filename FROM documents WHERE stored_filename = ?", 
                (source_file,)
            )
            result = cursor.fetchone()
            if not result:
                # 跳过不存在的文档
                print(f"跳过不存在的文档: {source_path}")
                continue
                
            document_id = result['id']
            document_name = result['original_filename']
        else:
            document_name = "未知文档"
            # 如果没有源路径，则无法确定文档ID
            document_id = None
        
        # 计算相关度分数 (如果提供了嵌入向量)
        relevance_score = None
        if query_embedding is not None and doc_embeddings is not None and i < len(doc_embeddings):
            relevance_score = calculate_relevance_score(query_embedding, doc_embeddings[i])
        
        # 尝试从元数据中提取页码信息，确保它是数字类型
        page_number = None
        page_label = None
        
        # 首先尝试获取页面标签，这通常是PDF中显示的实际页码
        if metadata and 'page_label' in metadata:
            try:
                page_label = metadata['page_label']
                # 如果页面标签是数字，转换为整数用于跳转
                if isinstance(page_label, str) and page_label.isdigit():
                    page_number = int(page_label)
            except (ValueError, TypeError):
                pass
        
        # 如果没有标签或无法解析，回退到索引页码
        if page_number is None and metadata and 'page' in metadata:
            try:
                # 如果是字符串，尝试转换为整数
                if isinstance(metadata['page'], str):
                    page_number = int(metadata['page'].strip())
                else:
                    page_number = int(metadata['page'])
                
                # 确保页码有效 (大于0)
                if page_number < 1:
                    page_number = 1
            except (ValueError, TypeError):
                print(f"无法解析页码: {metadata['page']}，使用默认值1")
                page_number = 1
        
        # 创建源信息对象
        source_info = {
            "document_name": document_name,
            "document_id": document_id,  # 添加文档ID
            "content": content,           # 保留完整内容用于高亮
            "content_preview": content[:400] + "..." if len(content) > 400 else content,  # 增加预览长度为400个字符
            "relevance_score": relevance_score,
            "page": page_number,  # 直接包含处理后的页码
            "page_label": page_label  # 包含原始页面标签
        }
        
        # 如果有其他元数据，也可以添加
        if metadata:
            # 过滤掉不需要的大型元数据 (如嵌入向量)
            filtered_metadata = {k: v for k, v in metadata.items() 
                               if k not in ['source'] and not isinstance(v, (list, np.ndarray)) 
                               or (isinstance(v, list) and len(v) < 20)}
            source_info["metadata"] = filtered_metadata
        
        sources.append(source_info)
    
    # 关闭数据库连接
    conn.close()
    
    # 按相关度分数排序 (如果有)
    if sources and sources[0].get("relevance_score") is not None:
        sources.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        # Filter out sources with relevance score below 70
        sources = [s for s in sources if s.get("relevance_score", 0) >= 70]
    
    return sources

def clean_llm_response(response: str) -> str:
    """
    清理LLM响应中的内部思考和特殊标记
    
    参数:
        response: LLM原始响应
        
    返回:
        str: 清理后的响应
    """
    if not response:
        return "抱歉，无法生成回答。"
    
    # 移除<think>...</think>块
    import re
    response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
    
    # 移除其他可能的思考标记
    response = re.sub(r'\*\*思考：.*?\*\*', '', response, flags=re.DOTALL)
    response = re.sub(r'\*\*thinking:.*?\*\*', '', response, flags=re.DOTALL)
    response = re.sub(r'<thinking>.*?</thinking>', '', response, flags=re.DOTALL)
    
    # 移除常见的思考引导词
    response = re.sub(r'(^|\n)让我思考一下[.：:][^\n]*\n', '\n', response)
    response = re.sub(r'(^|\n)Let me think[.：:][^\n]*\n', '\n', response)
    
    # 移除XML和Markdown中常见的特殊标记
    response = re.sub(r'</?[a-zA-Z][^>]*>', '', response)  # XML标签
    
    # 处理可能的引用格式保持一致
    response = re.sub(r'```[a-zA-Z]*\n', '', response)  # 代码块开始标记
    response = re.sub(r'```\n?', '', response)  # 代码块结束标记
    
    # 处理换行，保证段落之间有适当的空白
    response = re.sub(r'\n{3,}', '\n\n', response)  # 多个换行替换为两个
    
    # 确保文本有适当的首尾格式
    response = response.strip()
    
    return response

def rerank_documents(query: str, docs: List[Document]) -> List[Document]:
    """
    对文档进行重新排序，找出与查询最相关的文档
    
    参数:
        query: 用户查询
        docs: 检索到的文档列表
        
    返回:
        List[Document]: 重新排序的文档列表
    """
    try:
        # 这里可以使用第三方重排模型，如sentence-transformers中的CrossEncoder
        # 简单实现：根据关键词匹配度排序
        from collections import Counter
        
        # 将查询拆分为关键词
        import re
        # 移除标点符号并转为小写
        query_clean = re.sub(r'[^\w\s]', '', query.lower())
        query_terms = set(query_clean.split())
        
        # 计算每个文档包含多少查询关键词
        doc_scores = []
        for doc in docs:
            content_clean = re.sub(r'[^\w\s]', '', doc.page_content.lower())
            content_terms = Counter(content_clean.split())
            
            # 计算关键词匹配得分
            score = sum(content_terms[term] for term in query_terms if term in content_terms)
            doc_scores.append((doc, score))
        
        # 按得分降序排序
        doc_scores.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in doc_scores]
    except Exception as e:
        print(f"重新排序文档时出错: {str(e)}")
        return docs  # 出错时返回原始文档顺序

def perform_query(input_query: str, kb_id: Optional[int] = None, kb_ids: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
    """
    执行查询并返回回答与来源
    
    参数:
        input_query: 用户输入的查询
        kb_id: 知识库ID (可选，单个知识库查询)
        kb_ids: 知识库ID列表 (可选，多个知识库查询)
        
    返回:
        Dict[str, Any]: 包含回答和源信息的响应对象，失败时返回带有错误信息的字典
    """
    if not input_query:
        return {"error": "查询内容不能为空", "detail": "请提供一个有效的查询"}
    
    try:
        # 从环境变量获取模型名称，并尝试匹配已安装的模型
        import subprocess
        model_name = os.getenv('LLM_MODEL', 'deepseek-r1:14b')
        embedding_model_name = os.getenv('TEXT_EMBEDDING_MODEL', 'nomic-embed-text')
        
        print(f"使用语言模型: {model_name}")
        print(f"使用嵌入模型: {embedding_model_name}")
        
        # 初始化语言模型
        try:
            llm = ChatOllama(model=model_name)
        except Exception as model_error:
            print(f"初始化语言模型时出错: {str(model_error)}")
            # 尝试使用已安装的任意可用模型
            try:
                process = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
                models = process.stdout.strip().split('\n')[1:]  # 跳过标题行
                if models:
                    # 提取第一个可用模型的名称
                    available_model = models[0].split()[0]
                    print(f"尝试使用可用模型: {available_model}")
                    llm = ChatOllama(model=available_model)
                else:
                    return {
                        "error": "无法初始化语言模型",
                        "detail": f"指定的模型 {model_name} 不可用，且没有其他可用模型"
                    }
            except Exception as fallback_error:
                return {
                    "error": "无法初始化语言模型",
                    "detail": f"原始错误: {str(model_error)}, 回退错误: {str(fallback_error)}"
                }
                
        # 如果提供了kb_ids，使用多知识库查询模式
        if kb_ids and len(kb_ids) > 0:
            print(f"使用多知识库查询模式，知识库IDs: {kb_ids}")
            return query_multiple_knowledge_bases(input_query, kb_ids, llm)
                
        # 如果没有提供知识库ID，直接使用AI回答
        if kb_id is None and (not kb_ids or len(kb_ids) == 0):
            print("未提供知识库ID，使用直接对话模式")
            return direct_ai_chat(input_query, llm)
        
        # 验证知识库ID (如果提供)
        if kb_id is not None:
            from db_utils import check_knowledge_base_exists
            if not check_knowledge_base_exists(DB_PATH, kb_id):
                return {
                    "error": "知识库不存在",
                    "detail": f"ID为{kb_id}的知识库不存在"
                }
        
        # 获取向量数据库实例
        try:
            db = get_vector_db(kb_id)
            # 检查向量数据库是否为空
            if hasattr(db, '_collection') and db._collection.count() == 0:
                print(f"知识库 {kb_id} 为空，切换到直接对话模式")
                return direct_ai_chat(input_query, llm, kb_id)
        except Exception as db_error:
            print(f"获取向量数据库时出错: {str(db_error)}，切换到直接对话模式")
            return direct_ai_chat(input_query, llm, kb_id)
        
        # 获取提示模板
        query_prompt, answer_prompt = get_prompt()

        # 设置多重查询检索器
        try:
            retriever = MultiQueryRetriever.from_llm(
                retriever=db.as_retriever(search_kwargs={"k": 8}),
                llm=llm,
                prompt=query_prompt
            )
        except Exception as retriever_error:
            print(f"创建检索器时出错: {str(retriever_error)}，切换到直接对话模式")
            return direct_ai_chat(input_query, llm, kb_id)
        
        # 执行检索以获取相关文档
        try:
            retrieved_docs = retriever.get_relevant_documents(input_query)
        except Exception as retrieve_error:
            print(f"检索文档时出错: {str(retrieve_error)}，切换到直接对话模式")
            return direct_ai_chat(input_query, llm, kb_id)
        
        if not retrieved_docs:
            print("没有找到相关文档，切换到直接对话模式")
            return direct_ai_chat(input_query, llm, kb_id)
        
        # 重新排序文档以提高相关性
        reranked_docs = rerank_documents(input_query, retrieved_docs)
        
        # 只使用前4个最相关的文档
        top_docs = reranked_docs[:4]
        
        # 获取并格式化源信息 (包含相关度分数)
        try:
            # 尝试获取嵌入向量以计算相关度
            from langchain_community.embeddings import OllamaEmbeddings
            embedding_model = OllamaEmbeddings(model=embedding_model_name)
            query_embedding = embedding_model.embed_query(input_query)
            doc_embeddings = [embedding_model.embed_query(doc.page_content) for doc in top_docs]
            sources = format_sources(top_docs, query_embedding, doc_embeddings)
            
            # 过滤掉相关度分数低于70的文档
            relevant_sources = [s for s in sources if s.get("relevance_score", 0) >= 70]
        except Exception as embed_error:
            print(f"计算相关度分数时出错: {str(embed_error)}")
            # 继续而不计算相关度分数
            sources = format_sources(top_docs)
            relevant_sources = sources
        
        # 如果没有高相关度文档，直接使用AI回答问题
        if not relevant_sources:
            print("没有找到高相关度文档，使用AI直接回答问题")
            try:
                direct_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. 
                Your task is to answer the question based on your knowledge.
                If you don't know the answer, just say you don't have enough information.
                
                Question: {question}
                
                Please provide a clear, professional answer with the language of the question:
                """)
                
                formatted_prompt = direct_prompt.format(question=input_query)
                raw_answer = llm.invoke(formatted_prompt).content
                clean_answer = clean_llm_response(raw_answer)
                
                response = {
                    "answer": clean_answer,
                    "sources": sources,  # Include all sources even if they're low relevance
                    "query": {
                        "original": input_query,
                        "kb_id": kb_id
                    },
                    "note": "No highly relevant information found in the knowledge base. This answer is based on the AI's general knowledge."
                }
                
                return response
            except Exception as llm_error:
                print(f"生成直接回答时出错: {str(llm_error)}")
                return {
                    "error": "无法生成回答",
                    "detail": str(llm_error)
                }
        
        # 使用高相关度文档作为上下文
        context = "\n\n".join([s["content"] for s in relevant_sources])
        
        # 生成回答
        try:
            formatted_prompt = answer_prompt.format(context=context, question=input_query)
            raw_answer = llm.invoke(formatted_prompt).content
        except Exception as llm_error:
            print(f"生成回答时出错: {str(llm_error)}")
            return {
                "error": "无法生成回答",
                "detail": str(llm_error)
            }
        
        # 清理响应
        clean_answer = clean_llm_response(raw_answer)
        
        # 组装最终响应
        response = {
            "answer": clean_answer,
            "sources": sources,  # Include all sources even if they're low relevance
            "query": {
                "original": input_query,
                "kb_id": kb_id
            }
        }
        
        return response
    except Exception as e:
        print(f"执行查询时发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "error": "查询执行失败",
            "detail": str(e)
        }

def query_multiple_knowledge_bases(input_query: str, kb_ids: List[int], llm) -> Dict[str, Any]:
    """
    查询多个知识库并合并结果
    
    参数:
        input_query: 用户输入的查询
        kb_ids: 知识库ID列表
        llm: 语言模型实例
        
    返回:
        Dict[str, Any]: 包含回答和合并的源信息的响应对象
    """
    try:
        print(f"开始查询多个知识库: {kb_ids}")
        
        # 获取提示模板
        query_prompt, answer_prompt = get_prompt()
        
        # 存储所有知识库的相关文档
        all_sources = []
        all_docs = []
        
        # 获取嵌入模型
        embedding_model_name = os.getenv('TEXT_EMBEDDING_MODEL', 'nomic-embed-text')
        from langchain_community.embeddings import OllamaEmbeddings
        embedding_model = OllamaEmbeddings(model=embedding_model_name)
        
        # 查询每个知识库
        for kb_id in kb_ids:
            try:
                print(f"查询知识库 {kb_id}")
                
                # 验证知识库是否存在
                from db_utils import check_knowledge_base_exists
                if not check_knowledge_base_exists(DB_PATH, kb_id):
                    print(f"知识库 {kb_id} 不存在，跳过")
                    continue
                
                # 获取向量数据库实例
                db = get_vector_db(kb_id)
                
                # 检查向量数据库是否为空
                if hasattr(db, '_collection') and db._collection.count() == 0:
                    print(f"知识库 {kb_id} 为空，跳过")
                    continue
                
                # 设置多重查询检索器
                try:
                    retriever = MultiQueryRetriever.from_llm(
                        retriever=db.as_retriever(search_kwargs={"k": 5}),  # 每个知识库获取少一些文档
                        llm=llm,
                        prompt=query_prompt
                    )
                    
                    # 执行检索以获取相关文档
                    docs = retriever.get_relevant_documents(input_query)
                    
                    if docs:
                        # 重新排序文档以提高相关性
                        reranked_docs = rerank_documents(input_query, docs)
                        
                        # 只保留最相关的前3个文档，避免太多文档
                        top_docs = reranked_docs[:3]
                        
                        # 计算嵌入向量
                        query_embedding = embedding_model.embed_query(input_query)
                        doc_embeddings = [embedding_model.embed_query(doc.page_content) for doc in top_docs]
                        
                        # 格式化源信息
                        sources = format_sources(top_docs, query_embedding, doc_embeddings)
                        
                        # 过滤掉相关度分数低于65的文档 (多知识库查询时稍微降低阈值)
                        relevant_sources = [s for s in sources if s.get("relevance_score", 0) >= 65]
                        
                        if relevant_sources:
                            # 添加知识库ID到源信息
                            for source in relevant_sources:
                                source["knowledge_base_id"] = kb_id
                            
                            # 将相关文档和源信息添加到总列表
                            all_sources.extend(relevant_sources)
                            all_docs.extend(top_docs)
                            
                            print(f"从知识库 {kb_id} 找到 {len(relevant_sources)} 个相关源")
                        else:
                            print(f"知识库 {kb_id} 未找到高相关度文档")
                    else:
                        print(f"知识库 {kb_id} 未找到相关文档")
                except Exception as e:
                    print(f"查询知识库 {kb_id} 时出错: {str(e)}")
                    continue
            except Exception as e:
                print(f"处理知识库 {kb_id} 时出错: {str(e)}")
                continue
        
        # 如果没有找到任何相关源，使用直接对话模式
        if not all_sources:
            print("所有知识库中都没有找到相关信息，使用直接对话模式")
            return direct_ai_chat(input_query, llm)
        
        # 按相关度分数对所有源排序
        all_sources.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        
        # 限制最多使用10个源，避免上下文过长
        top_sources = all_sources[:10]
        
        # 使用高相关度文档作为上下文
        context = "\n\n".join([s["content"] for s in top_sources])
        
        # 生成回答
        try:
            # 使用多知识库模板
            multi_kb_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. 
            Your task is to answer the question based on the context provided from multiple knowledge bases.
            Synthesize information from all relevant sources to provide a comprehensive answer.
            Make sure to consider information from all knowledge bases.
            
            Context:
            {context}
            
            Question: {question}
            
            Please provide a clear, professional answer with the language of the question:
            """)
            
            formatted_prompt = multi_kb_prompt.format(context=context, question=input_query)
            raw_answer = llm.invoke(formatted_prompt).content
            clean_answer = clean_llm_response(raw_answer)
            
            # 组装最终响应
            response = {
                "answer": clean_answer,
                "sources": top_sources,
                "query": {
                    "original": input_query,
                    "kb_ids": kb_ids
                },
                "is_multi_kb_query": True
            }
            
            return response
        except Exception as llm_error:
            print(f"生成多知识库回答时出错: {str(llm_error)}")
            return {
                "error": "无法生成回答",
                "detail": str(llm_error)
            }
    except Exception as e:
        print(f"多知识库查询出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return direct_ai_chat(input_query, llm)

def direct_ai_chat(input_query: str, llm, kb_id=None):
    """
    直接使用AI进行对话，不使用知识库
    
    参数:
        input_query: 用户输入的查询
        llm: 语言模型实例
        kb_id: 知识库ID (可选，仅用于记录)
        
    返回:
        Dict[str, Any]: 包含回答的响应对象
    """
    try:
        # 使用简单提示模板进行直接对话
        direct_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. 
        Your task is to answer the question based on your knowledge.
        If you don't know the answer, just say you don't have enough information.
        
        Question: {question}
        
        Please provide a clear, professional answer with the language of the question:
        """)
        
        formatted_prompt = direct_prompt.format(question=input_query)
        raw_answer = llm.invoke(formatted_prompt).content
        clean_answer = clean_llm_response(raw_answer)
        
        response = {
            "answer": clean_answer,
            "sources": [],  # 没有知识库文档作为来源
            "query": {
                "original": input_query,
                "kb_id": kb_id
            },
            "is_direct_chat": True  # 标记这是直接对话模式
        }
        
        return response
    except Exception as e:
        print(f"直接对话模式出错: {str(e)}")
        return {
            "error": "生成回答失败",
            "detail": str(e)
        }