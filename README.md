# AI_Test
# 安装 Rust (Tauri 依赖)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js 18+
# Windows 用户从 https://nodejs.org 下载安装包

# 安装 Tauri CLI
npm install --global @tauri-apps/cli

# 安装 PNPM (替代 npm)
npm install --global pnpm

tauri --version

#如果error
mkdir -p ~/.npm-global

npm config set prefix '~/.npm-global'

echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc 

npm install --global @tauri-apps/cli

pnpm add -D vite @vitejs/plugin-react