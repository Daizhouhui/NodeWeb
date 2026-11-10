# Vless节点生成工具 2026 版

一个功能强大的Web工具，用于将CSV数据转换为Vless节点链接，生成Base64订阅，并与GitHub仓库同步。

节点仓库已设为私有，对应的仓库主页和订阅入口由 Cloudflare Worker 提供：

- NodeWeb 生成页：https://daizhouhui.github.io/NodeWeb/
- 节点仓库主页（Worker）：https://manager.knny.dpdns.org

默认情况下，上传订阅文件成功后，页面会调用 Worker 的 `/api/subscription-link` 接口，获取并显示由 Worker 返回的受保护订阅链接（仅限 `config.js` 中 `github.worker.repo` 指定的仓库）；切换到其他仓库或手动选择 GitHub Raw/Pages 时仍使用原有 GitHub 链接。Worker 不可用时会自动回退到 GitHub Raw。

## 配置文件

所有配置项集中在根目录的 `config.js` 中，按以下顺序分组：

- `defaultVlessConfig`：Vless 节点默认配置（UUID、Host、SNI、Path、指纹、ECH、默认端口、别名前缀、固定协议参数和页面默认勾选项）。
- `github`：GitHub 订阅同步配置，包括仓库、分支、令牌存储键、订阅文件名、默认下载/上传路径、链接类型、GitHub API、重试策略和 Cloudflare Worker。
- `vlessPresets`：高级配置中 UUID / Host / SNI / Path / 指纹的下拉候选值。
- `theme`：主题列表、默认主题、本地存储键和移动端断点。
- `ui`：界面开关与交互延迟。
- `csv`：CSV 列默认值。
- `logs` / `notifications`：日志保留条数与通知显示时长。
- `clash`：Clash YAML 的文件名、端口、代理组和分流规则。
- `qr`：二维码尺寸、缓存键、库地址和外部服务列表。
- `geolocation`：IP 属地数据库的加载路径。

修改 `config.js` 后刷新页面即可生效。页面中的输入框会自动使用这些默认值，但仍可在页面上临时修改。

## 代码结构

`index.html` 只保留页面结构与脚本引用，原内联脚本已按功能拆分到 `js/` 目录：

- `js/theme-init.js`：页面头部主题初始化。
- `js/app-core.js`：配置读取、全局状态、Worker 与 GitHub 上传基础逻辑。
- `js/app-events.js`：页面事件绑定。
- `js/app-ui.js`：主题切换、标签页、拖拽上传、Vless 直链等界面逻辑。
- `js/app-csv.js`：CSV 列检测。
- `js/app-generator.js`：节点生成、解析与预览。
- `js/app-manual.js`：手动 Vless 转换工具。
- `js/app-github.js`：远程下载、合并、上传与一键同步。
- `js/app-clash.js`：Clash YAML 生成与 Vless URL 解析。
- `js/app-runtime.js`：通知、日志、二维码、IP 属地与通用工具。

脚本按上述顺序加载，函数与全局状态的作用范围与原单文件版本一致。

## 使用指南

本工具可以从 CSV/TXT 或 IP:端口文本生成 VLESS 节点，也可以载入已有的 VLESS 直链。生成结果可在页面中复制、下载、转换成 Base64 或 YAML，并可选择与 GitHub 仓库中的订阅合并。

页面快捷操作区可循环切换六种主题，所选样式会保存在当前浏览器中。新浏览器的默认主题由根目录的 `config.js` 控制；将 `theme.default` 设置为 `1`（经典浅色）、`2`（经典暗夜）、`3`（澄光浅色）、`4`（澄光暗夜）、`5`（莓紫轻羽）或 `6`（莓紫夜幕）。已保存的浏览器主题优先于该默认设置。

“上传合并优选订阅”按钮默认隐藏。需要显示时，在 `config.js` 中将 `ui.showMergedSubscriptionUploadButtons` 设为 `true`。默认优选订阅文件名在 `github.files.optimal` 中配置。

下载/上传路径选择“自定义路径”后，可直接输入仓库文件路径，也可以点击下拉按钮读取仓库文件列表并按输入内容筛选。`github.files.csvNodes` 用于配置 CSV 节点 `IP:端口#别名` 文本的文件名。`一键同步远程` 会下载当前所选路径的远程订阅，按当前配置替换节点、按 `IP:端口` 去重，再以双重 Base64 上传回同一路径（仅远程节点，不与本地节点合并）。

## 1. 导入节点数据

在页面的“CSV数据源”卡片中选择一种输入方式。

### 上传 CSV/TXT

- 将 `.csv` 或 `.txt` 文件拖放到上传区域，或点击区域选择文件。支持同时选择多个文件。
- 上传后会自动检测列并生成节点。拖放与手动选择都会读取本次选中的文件；如果检测出的列不符合你的文件格式，可在“CSV列配置”中调整后重新生成。
- 有标题行时建议保留列名，例如 `ip`、`port`、`city`、`country`、`region`、`speed`，方便自动识别。
- 列序号从 `0` 开始：A 列为 `0`、B 列为 `1`，以此类推。某项设为 `-1` 表示不指定该列。
- 多文件上传时，工具会合并文件内容，并尝试跳过后续文件重复出现的标题行。

CSV 示例：

```csv
ip,port,city,country,speed
203.0.113.10,443,Tokyo,Japan,120 Mbps
203.0.113.11,8443,Seoul,South Korea,80 Mbps
```

“智能检测列”会根据文件内容推断列位置。若生成数量明显少于数据行数，先检查 IP 列是否选对、每行地址是否有效，以及标题行是否被误判；必要时手动填写 IP/端口列并再次生成。

### 粘贴内容

“粘贴内容”支持多行或混合格式，例如：

```text
203.0.113.10:443
203.0.113.11,8443
203.0.113.12 443
203.0.113.13;8443
```

只有 IP 或域名时，会使用“配置”里的默认端口。此输入方式也适用于直接粘贴 IP:端口清单。

### 载入 VLESS 直链

在“Vless直链”页签中每行粘贴一个 `vless://` 链接，然后点击“载入Vless直链”。此方式保留直链和原别名，不从地址查询属地，也不重新命名；载入后可以直接上传到指定 GitHub 路径。

## 2. 配置并生成

### 常用配置

“配置”页签中的选项包括：

- **默认端口**：数据没有端口时使用，默认值为 `443`。
- **别名前缀**：生成节点别名时使用的前缀。
- **强制所有节点使用443端口**：勾选后忽略输入端口，统一使用 `443`。
- **自动识别IP属地生成别名**：根据地址尝试补充属地信息。
- **合并时重新设置所有节点别名**：控制合并结果是否统一重命名。
- **优先使用CSV信息生成别名**：有城市、国家或地区信息时优先使用这些字段。

### CSV 列配置

上传文件后可检查或修改 IP 地址、端口、城市、国家、地区码和下载速度所在的列。IP 列是生成节点必需的信息；端口、地名和速度列按需配置。没有端口列时，将使用默认端口。

### 高级配置

高级配置可修改 VLESS 用户 ID（UUID）、Host、SNI、指纹和 ECH 等参数。确认参数后，点击“生成Vless节点”。结果区域会显示本地生成的 VLESS 链接、Base64 订阅和 YAML；可按页面提供的按钮复制或下载。

## 3. 查看、合并与同步到 GitHub

### 配置 GitHub 仓库

1. 在“GitHub订阅同步”的“常用”页签输入 GitHub 令牌。令牌需有目标仓库所需的访问权限；页面会提示所需权限。
2. 可选中“保存令牌到本地存储”以便下次使用。不希望在当前浏览器保存时取消勾选。
3. 在“高级（不常用）”页签确认仓库（默认取 `github.repo`，即 `DaiZhouHui/CustomNode`）、分支（默认取 `github.branch`，即 `main`）和订阅文件名（`github.files.optimal` / `main` / `plain`）。
4. 在“生成链接类型”中选择链接方式：`Worker 订阅链接`（默认，仅限 `github.worker.repo` 指定的仓库）、`GitHub Raw` 或 `GitHub Pages`。选择 Worker 时，若仓库不匹配或请求失败会自动回退 GitHub Raw；选择 Raw/Pages 则保留原有的纯 GitHub 链接方式。

不要将访问令牌粘贴到公开内容或提交到代码仓库。对不再使用的令牌，应在 GitHub 设置中撤销。

### 订阅链接（Cloudflare Worker）

订阅文件（Optimal 以及自定义订阅路径）上传成功后，页面会携带当前 GitHub 令牌请求 Worker：

```http
POST https://manager.knny.dpdns.org/api/subscription-link
Authorization: Bearer <githubToken>
Content-Type: application/json

{ "file": "上传的文件名" }
```

请求成功时，页面使用响应中的 `url` 作为订阅链接。YAML 配置文件不是订阅文件，仍显示 GitHub 链接（默认 Raw）。

“生成链接类型”默认选中 Worker（`github.defaultLinkType`）；也可以手动切换回 GitHub Raw 或 GitHub Pages，继续使用原来的链接方式。Worker 目前只管理 `config.js` 中 `github.worker.repo` 指定的仓库（默认 `DaiZhouHui/CustomNode`），切换到其他仓库时会自动改用 GitHub Raw，不会请求 Worker。

若 Worker 请求失败（例如令牌无效、网络异常或跨域被拒绝），页面会提示“订阅链接回退”，并自动使用 GitHub Raw 链接，不影响文件本身已上传成功的结果。

Worker 地址在 `config.js` 的 `github.worker.baseUrl` 中配置，管理仓库由 `github.worker.repo` 配置；将 `github.worker.baseUrl` 留空可禁用 Worker 链接。

### 下载与合并

- 选择远程订阅路径，点击“下载远程订阅”载入节点。
- 点击“合并节点”将本地节点与远程节点合并，并查看合并结果预览。
- 检查预览和节点数量后，再选择上传合并后的优选订阅。
- “一键同步远程”会下载当前所选路径的远程订阅，替换节点并去重后，上传回同一路径。
- “上传本地订阅至指定路径”用于上传本地生成的订阅；上传路径可以使用预设文件名，也可以选择自定义路径。
- 删除远程文件属于不可轻易撤销的操作。执行前确认仓库、分支和文件名正确。

页面顶部也提供常用操作入口。上传到 GitHub 会修改目标仓库内容，请先核对目标路径和预览结果。

## 4. 手动转换工具

页面下方的“手动Vless转换工具”可独立处理已有节点：

- **转Base64**：将每行一个的 VLESS 链接转换为 Base64 订阅。
- **转IP:端口**：从 VLESS 链接提取地址和端口，可复制或下载 TXT。
- **转YAML**：生成 Clash YAML，可测试解析、复制、下载；页面提供上传 YAML 的操作。

## 常见问题

### 生成的节点数量比 CSV 数据行少

确认每条数据行都含有可识别的 IP 或域名，IP 列索引正确，CSV 分隔符及引号格式正常。重新执行“智能检测列”；若仍不准确，手动设置 IP 列和端口列再生成。带标题行的文件通常会自动识别标题，但也应检查检测结果。

### 城市或国家没有正确转换

确认城市、国家和地区码列的索引没有填错。地点映射覆盖常见名称和代码，但不保证识别所有拼写、缩写或自定义标签；无法匹配时可能保留输入文本。

### GitHub 下载或上传失败

确认网络可访问 GitHub、令牌有效且有目标仓库权限，并检查仓库名、分支和文件路径。若令牌曾保存于浏览器，可取消保存后重新输入；令牌失效时应到 GitHub 撤销并重新创建。

## 隐私与安全

节点数据在浏览器中处理。使用 GitHub 同步时，工具会通过 GitHub API 访问你配置的仓库；若勾选保存令牌，令牌会保存在当前浏览器的本地存储中。上传订阅文件后，工具还会把令牌以 `Bearer` 方式发送到 `config.js` 中 `github.worker.baseUrl` 指定的 Cloudflare Worker，用于验证私有仓库访问权限并生成受保护订阅链接。请确认该地址是你信任的服务，使用最小必要权限，并避免在共享设备上保存令牌。

## 参与贡献

欢迎通过 GitHub Issue 反馈问题，或提交 Pull Request 改进项目。

**兼容性**：建议使用较新版本的 Chrome、Firefox 或 Edge。