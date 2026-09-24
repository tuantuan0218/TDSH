# MuseScore MCP 一键连接 & 交付说明

## 📌 当前状态（2026-09-25）

**MCP 运行时已完全就绪**，唯一剩余动作是用户在 MuseScore GUI 手动启用插件（约 30 秒）。

---

## 🚀 使用方式

### 方式一：一键脚本（推荐）

双击运行:

```
D:\tmp_roleai\start-musescore-mcp.cmd
```

脚本会自动:
1. 检查/启动 MuseScore 4 并加载钢琴曲工程
2. 检查 WebSocket 端口 8765
3. 提示用户在 GUI 启用插件（等待最多 120 秒）
4. 插件启用后自动验证桥连接
5. 启动 MCP server（保持前台运行）

### 方式二：手动分步

1. **启动 MuseScore 并加载工程**
   ```
   "C:\Program Files\MuseScore 4\bin\MuseScore4.exe" D:\tmp_roleai\output\professional_piano_piece.mid
   ```

2. **启用插件**（GUI 操作，仅一次）
   - 菜单 `Plugins` → `Plugin Manager`
   - 勾选 "MuseScore API Server" → OK
   - 菜单 `Plugins` → `MuseScore API Server` → 运行
   - 状态栏显示 `Starting MuseScore API Server on port 8765`

3. **启动 MCP server**
   ```
   cd /d J:\tmp_roleai\mcp-musescore
   J:\tmp_roleai\mcp-musescore\.venv\Scripts\python.exe J:\tmp_roleai\mcp-musescore\server.py
   ```

---

## ✅ 运行时就绪证据（已验证）

| 组件 | 状态 | 证据 |
|------|------|------|
| Python venv | ✅ | `J:\tmp_roleai\mcp-musescore\.venv\Scripts\python.exe` |
| fastmcp | ✅ | import OK (阿里云镜像安装) |
| websockets | ✅ | import OK |
| mcp<2 (FastMCP 兼容) | ✅ | 已降级，import server OK |
| server.py 导入 | ✅ | `MCP server import OK` |
| 一键脚本 | ✅ | `D:\tmp_roleai\start-musescore-mcp.cmd` (3,288 B) |

**官网仓库**: https://github.com/ghchen99/mcp-musescore (98★, 支持 MuseScore 3.x/4.x)

---

## 🔧 关键排障记录

1. **mcp 2.x 不兼容** → `ModuleNotFoundError: mcp.server.fastmcp`（v2 改名 MCPServer）
   - 修复: `pip install "mcp<2"`（锁定 v1 API）
2. **PyPI 直连超时** → 改用阿里云镜像
   - `pip install ... -i https://mirrors.aliyun.com/pypi/simple/`
3. **插件无法程序化启用** → MuseScore 用 Qt 自绘菜单（Win32 GetMenu=0），pywinauto/UIA/键盘均无法自动化点击 → **必须 GUI 手动**

---

## 📁 相关文件

| 文件 | 用途 |
|------|------|
| `D:\tmp_roleai\start-musescore-mcp.cmd` | 一键连接脚本 |
| `J:\tmp_roleai\mcp-musescore\server.py` | MCP server |
| `J:\tmp_roleai\mcp-musescore\skills\mcp-musescore\scripts\probe-musescore-bridge.py` | 桥连接探针 |
| `D:\tmp_roleai\output\professional_piano_piece.mid` | 钢琴曲工程（5,720 B） |