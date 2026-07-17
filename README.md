# 云评导出 / NetEase Comment Exporter

一个在本地运行的网易云音乐公开评论采集与导出工具。输入歌曲链接或歌曲 ID，即可按推荐、热门或最新顺序采集评论，并导出为 CSV 或 JSON。

> 本项目是非官方开源工具，与网易云音乐及其运营方没有关联。项目依赖第三方实现的非公开接口，接口可能随平台更新而失效。

## 功能

- 支持网易云音乐歌曲链接和纯数字歌曲 ID
- 支持推荐、热门、最新评论
- 分页采集、评论去重和失败重试
- 实时显示进度，支持取消任务
- 导出 CSV 和 JSON
- CSV 使用 UTF-8 BOM，方便常见表格软件直接打开中文内容
- 默认只监听本机 `127.0.0.1`
- 不需要账号密码或 Cookie

## 环境要求

- Node.js 22 或更高版本
- npm

## 本地运行

```bash
git clone https://github.com/PeiOrange888/netease-comment-exporter.git
cd netease-comment-exporter
npm install
npm start
```

浏览器打开：

```text
http://127.0.0.1:4317
```

也可以通过查询参数自动读取歌曲：

```text
http://127.0.0.1:4317/?song=186016
```

## 使用方式

1. 输入网易云音乐歌曲链接或歌曲 ID。
2. 点击“读取”确认歌曲信息。
3. 选择评论排序和采集数量。
4. 点击“开始采集”。
5. 任务完成或取消后，导出 CSV 或 JSON。

单次任务最多采集 5000 条。程序会在分页请求之间加入间隔，并对重复评论进行过滤。

## 数据与隐私

- 只读取评论区已经公开展示的内容。
- 导出字段包括评论内容、昵称、点赞数、回复数和发布时间。
- 不导出用户 ID、头像和 IP 属地。
- 采集任务只保存在进程内存中，服务重启后自动清空。
- 项目不会上传评论、歌曲信息或登录凭证到第三方服务器。

## 项目结构

```text
public/       本地网页界面
src/          服务端、采集任务和导出逻辑
test/         Node.js 自动测试
```

## 参考与致谢

本项目没有自行实现网易云音乐请求签名和底层接口，评论与歌曲数据能力直接依赖以下开源项目：

| 项目 | 用途 | 许可证 |
| --- | --- | --- |
| [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) | 网易云音乐第三方 Node.js API，本项目直接使用其 npm 包 | MIT |
| [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) | API Enhanced 的重要上游基础项目，GitHub 仓库现已归档 | MIT |
| [Express](https://github.com/expressjs/express) | 本地 HTTP 服务 | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | 网页界面图标 | ISC |

直接依赖的版本和许可信息见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。各第三方项目仍分别受其原始许可证约束。

## 开发与测试

```bash
npm test
```

测试覆盖歌曲 ID 解析、评论规范化、分页游标、去重、取消和 CSV 编码。

## 许可证

本项目自身代码使用 [MIT License](./LICENSE)。

## 免责声明

请合理控制采集数量和频率，并遵守适用的平台条款、法律法规和隐私要求。请勿将本项目用于绕过访问限制、采集非公开数据、骚扰用户或其他滥用行为。因上游接口变更、平台限制或使用方式产生的风险由使用者自行承担。
