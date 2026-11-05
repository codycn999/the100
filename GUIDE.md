# THE100 项目指南

## 项目简介

基于书籍《影响人类历史进程的100名人排行榜》（The 100: A Ranking of the Most Influential Persons in History）创建的网站项目。

目标：将 [codycn999/obsidianA](https://github.com/codycn999/obsidianA) 中的 Obsidian 笔记转换为中英双语历史人物地图与时间线。

## 数据来源

源仓库使用 [GUIDE.md](https://github.com/codycn999/obsidianA/blob/master/GUIDE.md) 说明知识库组织和维护规则。修改源笔记时应遵循该指南；本文件说明本站如何使用这些笔记。

以下路径均相对于 `obsidianA` 仓库根目录：

| 路径 | 用途 |
| --- | --- |
| [`wiki/_work/THE100/`](https://github.com/codycn999/obsidianA/tree/master/wiki/_work/THE100) | 100 篇中英双语人物章节，编号 001–100 |
| [`wiki/_work/THE100.md`](https://github.com/codycn999/obsidianA/blob/master/wiki/_work/THE100.md) | 书籍链接与 Dataview 索引；本站生成脚本不读取此文件 |
| [`wiki/_people/`](https://github.com/codycn999/obsidianA/tree/master/wiki/_people) | 人物姓名、生卒年、地区、身份标签、图片等属性 |
| [`wiki/_region/`](https://github.com/codycn999/obsidianA/tree/master/wiki/_region) | 国家、子区、大洲及其层级关系 |

通过 `OBSIDIAN_VAULT` 指定来源仓库中的 `wiki` 目录，或分别设置 `THE100_DIR`、`PEOPLE_DIR`、`REGION_DIR`。不要依赖某台电脑的 iCloud 绝对路径。克隆和运行示例见 [README.md](README.md)。

## 数据源结构

章节文件命名为 `THE100-{NNN} {中文名} {英文名}.md`，例如 `THE100-001 穆罕默德 Muhammad.md`。源章节的 YAML frontmatter 包含：

- `rank`：排名（1–100）
- `master`：关联 THE100 索引
- `about`：链接到 `wiki/_people/` 下的人物页
- `links`：PDF 链接（英文版和中文版）

正文格式：中英双语段落，段落之间用 `---` 分隔。

人物页中的 `birth`、`death`、`region`、`tags`、`img` 等字段用于本站展示。`tags` 使用源指南定义的 `role/领域/分类/身份` 层级；当前生成器使用第一个标签确定主要身份。

头像裁切位置是本站展示属性，与源人物笔记无关。启用 Cloudflare D1 后，`portrait_settings` 表按 THE100 排名保存原图 URL、0–100 的位置值和更新时间。数据库中的原图 URL 必须与当前人物图片一致，旧图片的裁切设置才不会误用于新图片。`portrait-positions.js` 保留为数据库不可用或该人物尚无记录时的静态后备值；未配置时默认为 50。

竖图的 0/50/100 分别表示靠上/居中/靠下；横图分别表示靠左/居中/靠右。数值表示裁切框在可移动空间中的百分比，图片始终等比铺满正方形，正方形原图不受此值影响。无效或缺失值按 50 处理，超出范围的数值限制到 0–100，小数四舍五入。

正文头像和大图弹窗提供“调整头像”入口，右键头像也可进入。管理员可拖动、使用滑块或直接输入数值预览，填写管理员密钥后保存到 D1。保存后当前页面立即更新；其他访客重新打开页面或返回标签页时读取最新记录，无需重新生成 `data.js` 或重新部署。页面只在当次请求中使用密钥，请求完成或弹窗关闭后清空输入框；站点代码不会将密钥写入项目文件或 localStorage。公开读取接口使用 `Cache-Control: no-store`；写入接口要求密钥，并校验排名、图片 URL 和位置范围。

地区页通过 `type` 区分 `country`、`subregion`、`continent`，通过 `master` 链关联国家 → 子区 → 大洲；部分国家直接关联大洲。

## 数据生成

- `build-data.js`：从章节文件名读取排名和中英文显示名称，按姓名匹配 `_people` 文件，合并人物属性和 `_region` 层级，再用 `country-ref.js` 补齐国家参考数据，生成 `data.js`。当前匹配逻辑不依赖章节 frontmatter 中的 `rank`、`about`；人物出生地坐标维护在脚本的 `COORDS` 表中。
- `build-content.js`：按章节文件名中的编号读取 Markdown 原文，生成 `content.js`。
- `enrich-data.js`：源笔记暂不可用时，将 `country-ref.js` 合并到已有 `data.js`，保留人物数据。
- `role-colors.js`：独立维护身份颜色，不随数据重新生成而丢失。
- `portrait-positions.js`：数据库不可用时的头像裁切后备值，不随数据重新生成而丢失。

### 头像位置数据库

`functions/api/portrait-positions.js` 提供同源 `/api/portrait-positions`：GET 读取记录，PUT 写入一条记录。数据库表定义见 `migrations/0001_portrait_settings.sql`。线上启用需要先在 Cloudflare 创建 D1 数据库，执行建表 SQL，再在 Pages 项目的 `wrangler.toml` 中绑定为 `PORTRAIT_DB`，并在 Pages 的生产环境配置加密密钥 `PORTRAIT_ADMIN_TOKEN`（至少 32 个字符）。具体操作见 [README.md](README.md)。没有数据库或密钥时，写入接口拒绝请求，网站继续按静态后备值显示。

`OUT_DATA`、`OUT_CONTENT` 可指定其他输出路径，便于比较结果后再替换。`build-data.js` 在少于 95 位人物解析出地区时会拒绝写入；先检查源笔记与匹配情况，不要直接用 `FORCE` 跳过保护。

本站提交了已生成的 `data.js`、`content.js`，可直接作为静态网站预览或部署。来源仓库与本站独立维护；复现结果时需记录并使用相同的来源提交和 Node.js 版本。

`index.html` 中 `role-colors.js`、`data.js`、`portrait-positions.js`、`content.js` 的脚本 URL 带有 `v` 版本参数，用于避开浏览器和 CDN 的旧缓存。参数值等于 `git hash-object <文件>` 的前七位（按 LF 换行计算，与操作系统无关）。更新这些文件后运行 `npm run bump` 自动同步，再一起提交部署；参数过期时 `npm test` 会失败。`build-content.js` 会把源笔记的换行统一为 LF，Windows 与其他系统生成结果一致。

`docs.suphy.top/file/` 上的人物头像另由 `index.html` 中的 `PORTRAIT_VERSION` 添加固定的 `v` 参数；源图片 URL 已有 `v` 时保留其值。若只替换同一地址的图片内容，应更新 `PORTRAIT_VERSION`（例如日期加修订号），并部署 `index.html`。这与 `data.js` 的版本独立，无需重新生成数据；其他图床的 URL 保持原样。

访客也可在人物正文头像下方、大图弹窗中点击“刷新头像”，或右键头像选择“刷新此头像”，仅为该源图片地址生成新的 `v` 并重新请求。手动刷新会覆盖该图片已有的 `v`，保留其他参数，并同步当前的缩略图和大图。此功能只对上述自有图床启用。版本保存在当前浏览器的 localStorage 中；存储不可用时仍可在当前页面刷新。全局 `PORTRAIT_VERSION` 更新后不再使用旧的本地覆盖版本；源图片地址改变后也不会沿用旧地址的覆盖版本。此操作无需重新部署，不修改源笔记或其他访客的版本，也不清除 CDN 缓存；能否获取新内容取决于图床及上游缓存是否按查询参数区分资源。
