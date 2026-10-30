# the100

中英双语历史人物地图与时间线。提交的静态文件可直接部署，无需重新生成数据。

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
