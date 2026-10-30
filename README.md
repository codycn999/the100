# the100

中英双语历史人物地图与时间线。提交的静态文件可直接部署，无需重新生成数据。

## 本地预览

使用任意静态 HTTP 服务器打开本目录。地图依赖外部 D3、TopoJSON 和 world-atlas 资源；地图数据失败时可重试，时间线仍可使用。

## 重新生成数据

需要 Node.js，以及原始 Obsidian wiki 数据（本仓库不包含完整源笔记）。PowerShell 示例：

```powershell
$env:OBSIDIAN_VAULT = 'D:/notes/wiki'
node build-data.js
node build-content.js
```

wiki 下需有 `_work/THE100`、`_people`、`_region`。也可分别设置 `THE100_DIR`、`PEOPLE_DIR`、`REGION_DIR`。人物章节以 `THE100-001 ...md` 等命名，frontmatter 含 `rank`、`about`，关联人物和地区笔记；正文为中英段落，以空行和 `---` 分组。参见 CLAUDE.md。

`OUT_DATA`、`OUT_CONTENT` 可将生成结果写到其他文件，便于比较后再替换。生成数据不足时 build-data 会拒绝覆盖；不要在未检查源笔记前使用 FORCE。

源笔记不可用时，可运行 `node enrich-data.js`，仅基于已有 data.js 和 country-ref.js 补全地区数据。角色颜色统一维护在 role-colors.js，不随数据生成而丢失。

复现数据需使用同一版本的源笔记和 Node.js；仅有本站代码不能重建私有笔记内容。

## 部署

wrangler.toml 指定 Cloudflare Pages 项目名 `the100`，静态发布目录为本目录。若项目已连接 GitHub，推送生产分支后由 Cloudflare 的既有设置触发部署；仓库本身没有 Actions 部署工作流。部署是否成功须以 Cloudflare 构建结果和线上页面为准。
