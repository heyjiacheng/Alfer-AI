# RAG from Álfer-AI

## 🔧 Installation
```bash
git clone https://github.com/heyjiacheng/Alfer-AI.git
```
### backend installation (from root directory)
```bash
cd backend
conda create --name rag python=3.12
conda activate rag
pip install -r requirements.txt
```
### frontend installation (from root directory)

install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
install Node.js 18+
```bash
# Windows users download install package from https://nodejs.org
```
install Tauri CLI
```bash
npm install --global @tauri-apps/cli
```


## 🌟 Quick start
### start backend (in separate terminal)
```bash
cd backend
conda activate rag
python app.py
```
### start frontend (in separate terminal)
```bash
cd ai-desktop-assistant
pnpm install
pnpm tauri dev
```