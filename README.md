# the100

中英双语历史人物地图与时间线。提交的静态文件可直接部署，无需重新生成数据。

## 开发与验证

使用 Node.js 20 或更新版本。`npm test` 运行网站测试；配置好 `OBSIDIAN_VAULT`（指向源仓库的 `wiki` 目录）后，`npm run check:build` 在临时目录验证数据生成，不覆盖已提交的 `data.js` 和 `content.js`。检查命令会提示生成结果是否与当前提交一致，但不会自动更新或提交数据。

## 本地预览

使用任意静态 HTTP 服务器打开本目录。地图依赖外部 D3、TopoJSON 和 world-atlas 资源；地图数据失败时可重试，时间线仍可使用。

## 重新生成数据

需要 Node.js，以及数据来源仓库 [codycn999/obsidianA](https://github.com/codycn999/obsidianA)。本站不重复存放完整源笔记；源仓库的组织和维护规则见其 [GUIDE.md](https://github.com/codycn999/obsidianA/blob/master/GUIDE.md)，本站的数据生成说明见 [GUIDE.md](GUIDE.md)。

在本站仓库根目录执行以下 PowerShell 命令，将来源仓库克隆到同级目录，并把 `OBSIDIAN_VAULT` 指向其中的 `wiki`（不是仓库根目录）：

```powershell
git clone https://github.com/codycn999/obsidianA.git ../obsidianA
$env:OBSIDIAN_VAULT = (Resolve-Path '../obsidianA/wiki').Path
node build-data.js
node build-content.js
```

若已有来源仓库，直接将 `OBSIDIAN_VAULT` 设置为其 `wiki` 绝对路径即可，无需再次克隆。

`wiki` 下需有 `_work/THE100`、`_people`、`_region`，也可分别设置 `THE100_DIR`、`PEOPLE_DIR`、`REGION_DIR`。人物章节以 `THE100-001 ...md` 等命名，frontmatter 含 `rank`、`about` 等字段，正文为中英段落，以空行和 `---` 分组。当前 `build-data.js` 从章节文件名读取排名和显示名称，并按姓名匹配 `_people` 条目；人物属性和地区层级分别来自 `_people`、`_region`。

`OUT_DATA`、`OUT_CONTENT` 可将生成结果写到其他文件，便于比较后再替换。生成数据不足时 build-data 会拒绝覆盖；不要在未检查源笔记前使用 FORCE。

源笔记不可用时，可运行 `node enrich-data.js`，仅基于已有 data.js 和 country-ref.js 补全地区数据。角色颜色统一维护在 role-colors.js，不随数据生成而丢失。

复现数据需使用同一版本的 `obsidianA` 源笔记和 Node.js；本站保存的生成结果不会随来源仓库更新而自动变化，需要重新运行生成脚本。

## 部署

wrangler.toml 指定 Cloudflare Pages 项目名 `the100`，静态发布目录为本目录。若项目已连接 GitHub，推送生产分支后由 Cloudflare 的既有设置触发部署；仓库本身没有 Actions 部署工作流。部署是否成功须以 Cloudflare 构建结果和线上页面为准。

### 启用头像位置在线保存

这一步只需做一次，之后管理员在网页中调整头像并保存即可，无需为每次调整重新部署：

1. 在 Cloudflare D1 中创建数据库 `the100`，保存其数据库 ID。数据库可以继续添加本站的其他业务表。
2. 用 D1 控制台执行 `migrations/0001_portrait_settings.sql`，或使用 `npx wrangler d1 execute the100 --remote --file=migrations/0001_portrait_settings.sql`。
3. 本仓库的 `wrangler.toml` 已将此数据库绑定为 `PORTRAIT_DB`；该文件是 Pages 配置的来源。更换数据库时需同步更新其中的数据库 ID，不要把密钥写进去。
4. 在 Cloudflare Pages 项目 `the100` 的生产环境「Settings → Variables and Secrets」新增加密密钥 `PORTRAIT_ADMIN_TOKEN`，使用至少 32 个随机字符；不要提交密钥或在聊天中发送。部署带有 Functions 和绑定的代码后，用网页编辑器输入该密钥保存。

访客读取 `/api/portrait-positions` 不需要密钥；只有 PUT 保存需要。图片 URL 更换后，旧图片的裁切记录不会作用于新图片。未完成 D1 配置时网站仍可显示头像，但在线保存会提示不可用。
