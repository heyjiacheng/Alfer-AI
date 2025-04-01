import os
import subprocess
import tempfile
from pathlib import Path
import logging
from typing import Optional, Tuple

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('audio_utils')

# 音频转录设置
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base.en')  # 可选: tiny.en, base.en, small.en, medium.en, large-v2
WHISPER_EXECUTABLE = os.getenv('WHISPER_EXECUTABLE', 'whisper-cpp')

def convert_audio_to_wav(input_file: str) -> Optional[str]:
    """
    使用ffmpeg将任何音频格式转换为wav格式，以便whisper处理
    
    参数:
        input_file: 输入音频文件路径
        
    返回:
        str: 转换后的临时wav文件路径，失败时返回None
    """
    try:
        if not os.path.exists(input_file):
            logger.error(f"输入文件不存在: {input_file}")
            return None
            
        # 创建临时文件
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            output_path = temp_file.name
        
        # 使用ffmpeg转换音频格式
        cmd = ['ffmpeg', '-i', input_file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output_path]
        
        logger.info(f"正在转换音频文件: {input_file} -> {output_path}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        if result.returncode != 0:
            logger.error(f"音频转换失败: {result.stderr.decode()}")
            return None
            
        return output_path
    except Exception as e:
        logger.error(f"音频转换过程中出错: {str(e)}")
        return None

def transcribe_audio(audio_file: str) -> Tuple[bool, str]:
    """
    使用whisper-cpp转录音频文件
    
    参数:
        audio_file: 音频文件路径
        
    返回:
        Tuple[bool, str]: (成功状态, 转录文本或错误消息)
    """
    try:
        # 确保输入文件存在
        if not os.path.exists(audio_file):
            return False, f"音频文件不存在: {audio_file}"
        
        # 获取文件扩展名
        file_ext = Path(audio_file).suffix.lower()
        
        # 如果不是wav格式，先转换
        wav_file = audio_file
        converted = False
        
        if file_ext != '.wav':
            wav_file = convert_audio_to_wav(audio_file)
            if not wav_file:
                return False, "无法将音频转换为WAV格式"
            converted = True
        
        logger.info(f"开始转录音频文件: {audio_file}")
        
        # 创建临时文件用于保存转录结果
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
            output_path = temp_file.name
        
        # 使用whisper-cpp进行转录
        cmd = [WHISPER_EXECUTABLE, '-m', f'/usr/local/share/whisper/{WHISPER_MODEL}.bin', '-f', wav_file, '-otxt', '-of', output_path]
        
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)  # 设置10分钟超时
        
        # 如果创建了临时WAV文件，删除它
        if converted and os.path.exists(wav_file):
            os.remove(wav_file)
        
        if result.returncode != 0:
            error_msg = result.stderr.decode()
            logger.error(f"转录失败: {error_msg}")
            
            # 如果输出文件已创建，删除它
            if os.path.exists(output_path):
                os.remove(output_path)
                
            return False, f"音频转录失败: {error_msg}"
        
        # 读取转录结果
        with open(output_path, 'r', encoding='utf-8') as f:
            transcript = f.read().strip()
        
        # 删除临时文件
        os.remove(output_path)
        
        if not transcript:
            return False, "转录结果为空"
            
        logger.info(f"音频转录成功，文本长度: {len(transcript)} 字符")
        return True, transcript
    except subprocess.TimeoutExpired:
        logger.error("转录超时")
        return False, "音频转录超时，文件可能太长或处理资源不足"
    except Exception as e:
        logger.error(f"转录过程中出错: {str(e)}")
        return False, f"音频转录错误: {str(e)}" 