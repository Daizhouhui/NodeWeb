/**
 * NodeWeb 全局配置
 *
 * 本文件集中维护页面所有默认配置。修改后刷新页面即可生效。
 * 加载顺序：index.html 在 <head> 中最先加载本文件，因此这里的值会覆盖页面内置的兜底值。
 *
 * 配置分组顺序：
 *   1. defaultVlessConfig  Vless 节点默认配置（置顶）
 *   2. github              GitHub 订阅同步配置
 *   3. vlessPresets        Vless 高级配置下拉候选值
 *   4. theme               主题配置
 *   5. ui                  界面与交互配置
 *   6. csv                 CSV 列默认配置
 *   7. logs / notifications 日志与通知配置
 *   8. clash               Clash YAML 模板配置
 *   9. qr                  二维码配置
 *   10. geolocation        IP 属地数据库配置
 */
window.NODE_WEB_CONFIG = {
  // ================================================================
  // 一、Vless 节点默认配置（最高优先级，置顶）
  // ================================================================
  defaultVlessConfig: {
    // ---- 基础连接参数 ----
    uuid: "99999999-9999-8999-9999-99abcdefabcd",
    host: "lin.kyma.dpdns.org",
    sni: "lin.kyma.dpdns.org",
    path: "/?ed=2048",

    // ---- 高级参数 ----
    fp: "chrome", // 浏览器指纹：chrome / firefox / safari / ios / android / edge
    ech: "cloudflare-ech.com+https://223.5.5.5/dns-query", // ECH 参数
    port: 443, // 默认端口
    prefix: "自选", // 别名前缀

    // ---- 固定协议参数（生成 vless:// 链接时使用）----
    encryption: "none",
    security: "tls",
    network: "ws",
    insecure: false,
    allowInsecure: false,

    // ---- 页面默认勾选项 ----
    forcePort443: false, // 强制所有节点使用 443 端口
    autoLocation: true, // 自动识别 IP 属地生成别名
    renameOnMerge: true, // 合并时重新设置所有节点别名
    useCsvInfo: true // 优先使用 CSV 信息生成别名
  },

  // ================================================================
  // 二、GitHub 订阅同步配置
  // ================================================================
  github: {
    // ---- 仓库与分支 ----
    repo: "DaiZhouHui/CustomNode", // 格式：owner/repo
    branch: "main",

    // ---- 令牌 ----
    tokenStorageKey: "github_token", // 本地存储中保存令牌使用的键名
    saveToken: true, // “保存令牌到本地存储”默认是否勾选

    // ---- 订阅文件名 ----
    files: {
      optimal: "Optimal", // 优选订阅
      main: "Main", // 主要订阅
      plain: "Plain", // 明文订阅
      yamlExtension: ".yaml" // 同名 YAML 配置的扩展名
    },

    // ---- 页面默认选项 ----
    defaultDownloadPath: "optimal", // 默认下载路径：main / optimal / plain / custom
    defaultUploadPath: "optimal", // 默认上传路径：main / optimal / plain / custom
    defaultLinkType: "worker", // 默认链接类型：worker / raw / pages
    downloadCacheTime: 2000, // 重复点击“下载远程订阅”的缓存清理间隔（毫秒）

    // ---- GitHub API ----
    api: {
      baseUrl: "https://api.github.com",
      accept: "application/vnd.github.v3+json"
    },
    // 链接模板：{repo} 仓库，{branch} 分支，{file} 文件名，{user} 用户名，{repo} 会按模板位置替换
    rawUrlTemplate: "https://raw.githubusercontent.com/{repo}/{branch}/{file}",
    pagesUrlTemplate: "https://{user}.github.io/{repo}/{file}",

    // ---- 上传/读取重试 ----
    retry: {
      maxRetries: 2, // 最大重试次数
      shaRateLimitDelay: 2000, // 读取 SHA 遇到 403/429 时每次重试的递增等待（毫秒）
      shaErrorDelay: 1000, // 读取 SHA 异常时每次重试的递增等待（毫秒）
      uploadShaMismatchDelay: 1000, // SHA 不匹配时每次重试的递增等待（毫秒）
      uploadRateLimitDelay: 3000, // 上传遇到 403/429 时每次重试的递增等待（毫秒）
      uploadErrorDelay: 2000 // 上传异常时每次重试的递增等待（毫秒）
    },

    // ---- Cloudflare Worker 订阅管理 ----
    worker: {
      baseUrl: "https://manager.knny.dpdns.org", // 留空或设为 false 可禁用 Worker 链接
      repo: "DaiZhouHui/CustomNode", // Worker 仅管理该仓库，格式：owner/repo
      subscriptionApiPath: "/api/subscription-link",
      timeout: 15000 // 请求超时时间（毫秒）
    }
  },

  // 高级配置中的下拉候选值（留空数组则不显示候选）
  vlessPresets: {
    uuid: [
      "471a8e64-7b21-4703-b1d1-45a221098459",
      "98765432-10fe-dcba-9876-543210fedcba",
      "99999999-9999-8999-9999-99abcdefabcd",
      "88888888-8888-8888-9888-88abcdefabcd"
    ],
    host: [
      "lin.kyma.dpdns.org",
      "node.knny.dpdns.org",
      "node.soren920.dpdns.org",
      "onlycore.knny.dpdns.org",
      "onlycore.soren920.dpdns.org",
      "el.kyma.dpdns.org"
    ],
    sni: [
      "lin.kyma.dpdns.org",
      "node.knny.dpdns.org",
      "node.soren920.dpdns.org",
      "onlycore.knny.dpdns.org",
      "onlycore.soren920.dpdns.org",
      "el.kyma.dpdns.org"
    ],
    path: [
      "/?ed=2048",
      "/knny96214?ed=2048",
      "/?ed=2048&auth=knny96214",
      "/"
    ],
    fp: ["chrome", "firefox", "safari", "ios", "android", "edge"]
  },

  // ================================================================
  // 三、主题配置
  // ================================================================
  theme: {
    // 默认主题序号：1 经典浅色，2 经典暗夜，3 澄光浅色，4 澄光暗夜，5 莓紫轻羽，6 莓紫夜幕
    default: 1,
    storageKey: "vless-node-theme-v2",
    dragPositionStorageKey: "vless-node-theme-button-position-v1",
    mobileBreakpoint: 768, // 移动端拖拽主题按钮的宽度阈值（px）
    list: [
      { id: "light", name: "经典浅色", icon: "☀️", dark: false },
      { id: "dark", name: "经典暗夜", icon: "🌙", dark: true },
      { id: "style3", name: "澄光浅色", icon: "🌿", dark: false },
      { id: "style4", name: "澄光暗夜", icon: "🌌", dark: true },
      { id: "style5", name: "莓紫轻羽", icon: "🌸", dark: false },
      { id: "style6", name: "莓紫夜幕", icon: "🌑", dark: true }
    ]
  },

  // ================================================================
  // 四、界面与交互配置
  // ================================================================
  ui: {
    showMergedSubscriptionUploadButtons: false, // 是否显示三个“上传合并”订阅按钮
    autoHideHeaderDelay: 3000, // 启动后自动隐藏标题栏的延迟（毫秒），0 表示不自动隐藏
    csvAutoGenerateDelay: 1000 // 粘贴 CSV 后自动生成节点的防抖延迟（毫秒）
  },

  // ================================================================
  // 五、CSV 列默认配置（1 表示 A 列，-1 表示无该列）
  // ================================================================
  csv: {
    defaultColumns: {
      ip: 1,
      port: -1,
      city: -1,
      country: -1,
      region: -1,
      speed: -1
    }
  },

  // ================================================================
  // 六、日志与通知配置
  // ================================================================
  logs: {
    maxEntries: 50 // 日志最多保留条数
  },

  notifications: {
    maxNotifications: 5, // 同屏最多通知数量
    // 各类型通知的自动关闭时间（毫秒）
    durations: {
      success: 2000,
      info: 3000,
      warning: 6000,
      error: 10000,
      default: 6000
    }
  },

  // ================================================================
  // 七、Clash YAML 模板配置
  // ================================================================
  clash: {
    fileName: "clash-config.yaml", // “转YAML”页签的默认文件名
    ports: {
      port: 7890,
      "socks-port": 7891,
      "redir-port": 7892,
      "mixed-port": 7893,
      "tproxy-port": 7895
    },
    allowLan: true,
    mode: "rule",
    logLevel: "info",
    ipv6: false,
    externalController: "127.0.0.1:9090",
    // 代理组：节点列表会自动填充为所有生成的节点
    proxyGroups: [
      { name: "🚀 节点选择", type: "select" },
      {
        name: "♻️ 自动选择",
        type: "url-test",
        url: "https://www.cloudflare.com/cdn-cgi/trace",
        interval: 300
      },
      {
        name: "🔥 故障转移",
        type: "fallback",
        url: "https://www.cloudflare.com/cdn-cgi/trace",
        interval: 300
      }
    ],
    // 分流规则，需与上面的代理组名称保持一致
    rules: [
      "DOMAIN-SUFFIX,google.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,youtube.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,github.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,twitter.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,facebook.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,instagram.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,telegram.org,♻️ 自动选择",
      "DOMAIN-SUFFIX,netflix.com,♻️ 自动选择",
      "DOMAIN-SUFFIX,spotify.com,♻️ 自动选择",
      "GEOIP,CN,DIRECT",
      "MATCH,♻️ 自动选择"
    ]
  },

  // ================================================================
  // 八、二维码配置
  // ================================================================
  qr: {
    size: 320, // 二维码尺寸（px）
    cacheKeyPrefix: "qr_cache_", // 二维码本地缓存键前缀
    libraryUrl: "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
    imageTimeout: 4000, // 图片探测超时（毫秒）
    // 最终兜底使用的服务地址
    fallbackService:
      "https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={data}",
    // 依次尝试的二维码服务，{size} 会替换为尺寸，{data} 会替换为 URL 编码后的内容
    services: [
      "https://cli.im/api/qrcode?text={data}&w={size}",
      "https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={data}",
      "https://chart.googleapis.com/chart?chs={size}x{size}&cht=qr&chl={data}"
    ]
  },

  // ================================================================
  // 九、IP 属地数据库配置
  // ================================================================
  geolocation: {
    // 依次尝试加载的 database.json 路径
    databasePaths: [
      "./database.json",
      "/database.json",
      "../database.json",
      "data/database.json"
    ]
  }
};
