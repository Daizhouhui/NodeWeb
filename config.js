window.NODE_WEB_CONFIG = {
  // 1: 经典浅色，2: 经典暗夜，3: 澄光浅色，4: 澄光暗夜，5: 莓紫轻羽，6: 莓紫夜幕
  defaultTheme: 1,
  showMergedSubscriptionUploadButtons: false,

  // Cloudflare Worker 订阅管理服务地址
  // 上传订阅文件成功后，页面会调用该服务的 /api/subscription-link 获取受保护的订阅链接。
  // 留空则跳过 Worker，直接使用 GitHub 链接。
  workerBaseUrl: "https://manager.knny.dpdns.org",

  // Vless节点默认配置
  defaultVlessConfig: {
    uuid: "99999999-9999-8999-9999-99abcdefabcd",
    host: "lin.kyma.dpdns.org",
    sni: "lin.kyma.dpdns.org",
    path: "/knny96214?ed=2048"
  }
};
