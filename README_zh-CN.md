# RouterAI

中文 | [English](README.md)

RouterAI是一个（正在开发中的）强大AI模型路由器，通过标准化的OpenAI兼容API接口提供对多个AI供应商的统一访问。RouterAI实现了智能路由、故障转移机制和速率限制处理，以确保AI模型的可靠访问。

## 为什么选择RouterAI？

RouterAI与OneAPI和FastChat等替代方案的区别在于关注以下关键方面：

- **最少依赖**：使用纯Node.js构建，无需复杂的依赖项或运行环境。
- **智能路由**：当遇到速率限制或错误时，在供应商之间实现智能故障转移。
- **生产就绪**：稳健地处理重试、速率限制和供应商特定的错误情况。
- **标准格式**：所有供应商响应都标准化为匹配OpenAI的格式，便于切换供应商。
- **零锁定**：通过简单的供应商接口易于扩展新供应商。

## 功能特性

### 核心功能
- 🔄 统一的OpenAI兼容API
- 🔀 供应商之间自动故障转移
- ⏱️ 内置速率限制处理和重试机制
- 🎯 跨供应商兼容的相同模型映射
- 🔌 可扩展的供应商架构

### 支持的供应商
- OpenAI/OpenAI兼容供应商
- Azure OpenAI
- Anthropic Claude
- Google Vertex AI
- Google AI Studio
- Amazon Bedrock
- Ollama（本地模型）

### 支持的端点
- 聊天补全（`/v1/chat/completions`）
- 文本补全（`/v1/completions`）
- 嵌入向量（`/v1/embeddings`）
- 模型列表（`/v1/models`）

## 安装

```bash
npm install
```

## 配置

根据以下示例创建`config.json`文件：

```json
{
    "https://api.openai.com": {
        "type": "openai",
        "api_key": "sk-your-api-key"
    }
    // 根据需要添加其他供应商
}
```

完整的供应商配置选项请参见`config_example.json`。

## 使用方法

### 启动服务器
```bash
node src/index.js
```

### API示例

#### 聊天补全
```http
POST /v1/chat/completions
Content-Type: application/json

{
    "model": "gpt-4",
    "messages": [
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "你好！"}
    ],
    "temperature": 0.7
}
```

#### 文本嵌入
```http
POST /v1/embeddings
Content-Type: application/json

{
    "model": "text-embedding-ada-002",
    "input": "你好世界"
}
```

## 贡献指南

1. Fork本仓库
2. 创建你的特性分支（`git checkout -b feature/amazing-feature`）
3. 提交你的更改（`git commit -m '添加惊人的特性'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 开启一个Pull Request

## 许可证

GNU Affero通用公共许可证v3.0（AGPL-3.0）

## 支持

如果您遇到任何问题或有疑问，请在GitHub上提出issue。
