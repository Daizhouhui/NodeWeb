// UTF-8 转 Base64 编码函数
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
}

// ==================== 配置读取辅助 ====================
// 所有默认值均来自 config.js；以下兜底仅用于配置缺项时避免页面报错。
function getWebConfig() {
  return window.NODE_WEB_CONFIG &&
    typeof window.NODE_WEB_CONFIG === "object"
    ? window.NODE_WEB_CONFIG
    : {};
}

function getVlessDefaults() {
  return getWebConfig().defaultVlessConfig || {};
}

function getGithubConfig() {
  return getWebConfig().github || {};
}

function getGithubFiles() {
  const files = getGithubConfig().files || {};
  return {
    optimal: files.optimal || "Optimal",
    csvNodes: files.csvNodes || "Nodes.txt",
    yamlExtension: files.yamlExtension || ".yaml",
  };
}

function getGithubFileName(key) {
  const files = getGithubFiles();
  return files[key] || "";
}

function getYamlExtension() {
  return getGithubFiles().yamlExtension || ".yaml";
}

function toYamlFileName(fileName) {
  return String(fileName).replace(/\.[^/.]+$/, "") + getYamlExtension();
}

function getGithubRepo() {
  const input = document.getElementById("githubRepo");
  const value = input ? input.value.trim() : "";
  return value || getGithubConfig().repo || "";
}

function getGithubBranch() {
  const input = document.getElementById("githubBranch");
  const value = input ? input.value.trim() : "";
  return value || getGithubConfig().branch || "main";
}

function getGithubToken() {
  const input = document.getElementById("githubToken");
  return input ? input.value.trim() : "";
}

function getGithubTokenStorageKey() {
  return getGithubConfig().tokenStorageKey || "github_token";
}

function getGithubApiBaseUrl() {
  const api = getGithubConfig().api || {};
  const base = typeof api.baseUrl === "string" ? api.baseUrl.trim() : "";
  return (base || "https://api.github.com").replace(/\/+$/, "");
}

function getGithubApiAccept() {
  const api = getGithubConfig().api || {};
  return api.accept || "application/vnd.github.v3+json";
}

function getGithubRetryConfig() {
  return Object.assign(
    {
      maxRetries: 2,
      shaRateLimitDelay: 2000,
      shaErrorDelay: 1000,
      uploadShaMismatchDelay: 1000,
      uploadRateLimitDelay: 3000,
      uploadErrorDelay: 2000,
    },
    getGithubConfig().retry || {},
  );
}

function getGithubWorkerConfig() {
  return getGithubConfig().worker || {};
}

function getGithubFileInputValue(inputId, fileKey) {
  const input = document.getElementById(inputId);
  const value = input ? input.value.trim() : "";
  return value || getGithubFileName(fileKey);
}

function resolveSelectedPathTarget(selectId, customInputId) {
  const select = document.getElementById(selectId);
  const selectedKey = select ? select.value : "";
  if (selectedKey === "custom") {
    const customInput = document.getElementById(customInputId);
    return {
      key: "custom",
      file: customInput ? customInput.value.trim() : "",
    };
  }
  return { key: selectedKey, file: getGithubFileName(selectedKey) };
}

function buildGithubTemplateUrl(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : match,
  );
}

function getClashConfig() {
  return getWebConfig().clash || {};
}

function getClashFileName() {
  return getClashConfig().fileName || "clash-config.yaml";
}

function getQrConfig() {
  return getWebConfig().qr || {};
}

function buildQrServiceUrl(template, size, targetUrl) {
  return String(template)
    .replace(/\{size\}/g, String(size))
    .replace(/\{data\}/g, encodeURIComponent(targetUrl));
}

// 全局数据
let data = {
  vlessLinks: [],
  localBase64Content: "", // 本地生成自动Base64
  localYamlContent: "", // 本地生成的YAML
  autoBase64Content: "", // 合并后自动Base64
  manualBase64Content: "", // 手动转换Base64
  manualIpPortContent: "", // 手动提取IP:端口
  manualYamlContent: "", // 手动转换YAML
  mergedYamlContent: "", // 合并生成的YAML
  remoteNodes: [],
  uniqueNodes: [],
  uploadedFiles: [], // 新增：已上传的文件列表
  optimalSha: null, // 新增：优选订阅文件的sha
  locationSha: null, // 本地生成Base64文件的sha
  stats: { local: 0, remote: 0, merged: 0, unique: 0 },
  currentSource: "none",
  // 新增：缓存管理数据
  cache: {
    remoteNodes: [], // 远程节点缓存
    lastDownloadTime: 0, // 上次下载时间戳f
    downloadPath: "", // 上次下载的路径
    needsUpdate: false, // 标记缓存是否需要更新
    lastLocalGeneration: 0, // 上次本地生成节点时间
  },
  // 新增：CSV列检测结果
  csvColumnDetection: {
    ipColumn: 0,
    portColumn: -1,
    cityColumn: -1,
    countryColumn: -1,
    regionColumn: -1,
    speedColumn: -1,
    speedColumnDetectedByHeader: false,
    hasHeader: false,
    detected: false,
  },
};

// 新增：日志数据
let logData = {
  entries: [],
  maxEntries: (getWebConfig().logs || {}).maxEntries || 50,
};

// 新增：通知数据
let notifications = {
  active: [],
  maxNotifications:
    (getWebConfig().notifications || {}).maxNotifications || 5,
};

// 新增：缓存时间戳
let lastDownloadTimestamp = 0;
const DOWNLOAD_CACHE_TIME = getGithubConfig().downloadCacheTime || 2000;

// 新增：确认对话框键盘事件处理器
let dialogKeyHandler = null;

document.addEventListener("DOMContentLoaded", () => {
  initDragDrop();
  initEvents();
  loadSavedToken();
  updateStats();
  addLog("系统启动", "Vless节点生成工具已启动，欢迎使用！", "info");
  initTabs();
  initAccordion();
  initHeaderToggle();
  initThemeToggle();

  // 初始化页面默认配置值（全部来自 config.js）
  try {
    applyConfigDefaults();
  } catch (e) {
    console.warn("加载默认配置失败:", e);
  }

  // 初始化版本号显示（日期版号，短格式：YY.MM.DD.HH）
  try {
    const vEl = document.getElementById("versionText");
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    vEl.textContent = `${yy}.${mm}.${dd}.${hh} - Vless节点生成工具`;
  } catch (e) {
    console.warn("不能设置版本号显示", e);
  }

  // 初始化粘贴输入框状态
  updateCSVInputState();

  // 初始化上传路径选择
  initUploadPathSelect();

  // 自动隐藏标题提示
  const autoHideHeaderDelay =
    Number((getWebConfig().ui || {}).autoHideHeaderDelay) || 0;
  if (autoHideHeaderDelay > 0) {
    setTimeout(() => {
      const headerInfo = document.getElementById("headerInfo");
      if (headerInfo && !headerInfo.classList.contains("hidden")) {
        headerInfo.classList.add("hidden");
      }
    }, autoHideHeaderDelay);
  }
});

// 将 config.js 中的默认值写入页面控件
function applyConfigDefaults() {
  const setValue = (id, value) => {
    if (value === undefined || value === null || value === "") return;
    const element = document.getElementById(id);
    if (element) element.value = value;
  };
  const setChecked = (id, checked) => {
    if (typeof checked !== "boolean") return;
    const element = document.getElementById(id);
    if (element) element.checked = checked;
  };

  // ---- Vless 默认配置 ----
  const vless = getVlessDefaults();
  setValue("uuid", vless.uuid);
  setValue("host", vless.host);
  setValue("sni", vless.sni);
  setValue("customPath", vless.path);
  setValue("fp", vless.fp);
  setValue("ech", vless.ech);
  setValue("defaultPort", vless.port);
  setValue("remarksPrefix", vless.prefix);
  setChecked("forcePort443", vless.forcePort443);
  setChecked("autoLocation", vless.autoLocation);
  setChecked("renameOnMerge", vless.renameOnMerge);
  setChecked("useCsvInfo", vless.useCsvInfo);
  setChecked("aliasShowSequence", vless.aliasShowSequence);
  setChecked("aliasShowSpeed", vless.aliasShowSpeed);

  const presets = getWebConfig().vlessPresets || {};
  fillPresetSelect("uuidPreset", presets.uuid);
  fillPresetSelect("hostPreset", presets.host);
  fillPresetSelect("sniPreset", presets.sni);
  fillPresetSelect("fpPreset", presets.fp);
  fillPresetSelect("pathPreset", presets.path);

  // ---- CSV 列默认值 ----
  const columns = (getWebConfig().csv || {}).defaultColumns || {};
  setValue("ipColumn", columns.ip);
  setValue("portColumn", columns.port);
  setValue("cityColumn", columns.city);
  setValue("countryColumn", columns.country);
  setValue("regionColumn", columns.region);
  setValue("speedColumn", columns.speed);

  // ---- GitHub 同步默认配置 ----
  const github = getGithubConfig();
  setValue("githubRepo", github.repo);
  setValue("githubBranch", github.branch);
  setChecked("saveToken", github.saveToken);
  setValue("optimalNodeFile", getGithubFileName("optimal"));
  setValue("csvNodesFile", getGithubFileName("csvNodes"));
  populatePathSelect(
    "downloadUrlSelect",
    github.defaultDownloadPath,
    ["optimal"],
  );
  populatePathSelect("uploadPathSelect", github.defaultUploadPath, [
    "optimal",
  ]);

  const linkTypeSelect = document.getElementById("fileLinkTypeSelect");
  if (linkTypeSelect) {
    linkTypeSelect.value = ["worker", "raw", "pages"].includes(
      github.defaultLinkType,
    )
      ? github.defaultLinkType
      : "worker";
  }

  const repoLink = document.getElementById("customNodeRepoLink");
  if (repoLink && github.repo) {
    repoLink.href = `https://github.com/${github.repo}`;
    repoLink.textContent = `${github.repo}-GitHub项目`;
  }

  // ---- Clash YAML 默认文件名 ----
  setValue("yamlFileName", getClashFileName());
}

function fillPresetSelect(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "";
  select.appendChild(placeholder);
  (Array.isArray(values) ? values : []).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.selectedIndex = 0;
}

function populatePathSelect(selectId, defaultKey, order) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const labels = {
    optimal: "优选订阅",
  };
  select.innerHTML = "";
  order.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${labels[key]}（${getGithubFileName(key)}）`;
    select.appendChild(option);
  });
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "自定义路径";
  select.appendChild(customOption);
  const allowed = order.concat("custom");
  const normalizedDefault = String(defaultKey || "").toLowerCase();
  const matchedKey = allowed.find(
    (key) =>
      key === normalizedDefault ||
      (key !== "custom" &&
        getGithubFileName(key).toLowerCase() === normalizedDefault),
  );
  select.value = matchedKey || order[0];
}

// 定时同步功能已移除

// Cloudflare Worker 订阅管理服务：上传订阅文件后获取受保护的订阅链接
let workerLinkWarningShown = false;

function getWorkerBaseUrl() {
  const configuredUrl = getGithubWorkerConfig().baseUrl;
  if (configuredUrl === false || configuredUrl === null) {
    return "";
  }
  if (typeof configuredUrl === "string") {
    // 显式留空表示禁用 Worker
    return configuredUrl.trim().replace(/\/+$/, "");
  }
  return "";
}

function openNodeRepository() {
  const url = getWorkerBaseUrl();
  if (!url) {
    showNotification("节点仓库", "尚未配置 Worker 服务地址", "warning");
    return;
  }
  window.location.href = url;
}

function isSubscriptionFile(fileName) {
  // YAML 是配置文件而不是订阅文件，继续使用 GitHub 链接
  const lowerName = String(fileName).toLowerCase();
  const yamlExtension = getYamlExtension().toLowerCase();
  return !(
    (yamlExtension && lowerName.endsWith(yamlExtension)) ||
    /\.ya?ml$/i.test(lowerName)
  );
}

function getWorkerRepo() {
  const configuredRepo = getGithubWorkerConfig().repo;
  return typeof configuredRepo === "string" ? configuredRepo.trim() : "";
}

function isWorkerManagedRepo(repo) {
  return (
    typeof repo === "string" &&
    repo.trim().toLowerCase() === getWorkerRepo().toLowerCase()
  );
}

function getSelectedLinkType() {
  const linkTypeEl = document.getElementById("fileLinkTypeSelect");
  const linkType = linkTypeEl ? linkTypeEl.value : "worker";
  return ["worker", "raw", "pages"].includes(linkType)
    ? linkType
    : "worker";
}

function buildGithubLink(repo, branch, fileName, linkType) {
  // 选择 worker 时，GitHub 链接作为回退，默认使用 Raw
  const githubConfig = getGithubConfig();
  const githubType = linkType === "pages" ? "pages" : "raw";
  if (githubType === "pages") {
    const parts = repo.split("/");
    if (parts.length >= 2) {
      return buildGithubTemplateUrl(
        githubConfig.pagesUrlTemplate ||
        "https://{user}.github.io/{repo}/{file}",
        {
          user: parts[0].toLowerCase(),
          repo: parts[1],
          file: fileName,
        },
      );
    }
  }
  return buildGithubTemplateUrl(
    githubConfig.rawUrlTemplate ||
    "https://raw.githubusercontent.com/{repo}/{branch}/{file}",
    {
      repo: repo,
      branch: branch,
      file: fileName,
    },
  );
}

async function fetchWorkerSubscriptionLink(fileName, token) {
  const workerBaseUrl = getWorkerBaseUrl();
  if (!workerBaseUrl) {
    throw new Error("未配置 Cloudflare Worker 服务地址");
  }
  if (!token) {
    throw new Error("缺少GitHub Token，无法向 Worker 验证身份");
  }

  const workerConfig = getGithubWorkerConfig();
  const timeout =
    Number(workerConfig.timeout) > 0 ? Number(workerConfig.timeout) : 15000;
  const apiPath =
    typeof workerConfig.subscriptionApiPath === "string" &&
      workerConfig.subscriptionApiPath.trim()
      ? workerConfig.subscriptionApiPath.trim()
      : "/api/subscription-link";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(
      `${workerBaseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: fileName }),
        signal: controller.signal,
      },
    );

    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        (result && result.error) ||
        `获取订阅链接失败（HTTP ${response.status}）`,
      );
    }

    if (!result || typeof result.url !== "string" || !result.url.trim()) {
      throw new Error("Worker 未返回有效的订阅链接");
    }

    // 兼容 Worker 返回相对路径的情况
    const url = result.url.trim();
    const resolvedUrl = /^https?:\/\//i.test(url)
      ? url
      : new URL(url, `${workerBaseUrl}/`).href;
    if (!/^https?:\/\//i.test(resolvedUrl)) {
      throw new Error("Worker 返回的订阅链接格式无效");
    }
    return resolvedUrl;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("获取订阅链接超时，请稍后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveSubscriptionLink(
  fileName,
  token,
  fallbackUrl,
  useWorkerLink = true,
  repo = "",
  linkType = "worker",
) {
  const workerBaseUrl = getWorkerBaseUrl();
  const isManagedRepo = isWorkerManagedRepo(repo);
  const canUseWorker =
    useWorkerLink &&
    linkType === "worker" &&
    isSubscriptionFile(fileName) &&
    !!workerBaseUrl;

  if (canUseWorker && !isManagedRepo) {
    console.info(
      `当前仓库 ${repo} 不在 Worker 管理范围（${getWorkerRepo()}），使用 GitHub 链接`,
    );
    addLog(
      "订阅链接",
      `仓库 ${repo} 不在 Worker 管理范围，已使用 GitHub 链接`,
      "info",
    );
  }

  if (!canUseWorker || !isManagedRepo) {
    return { url: fallbackUrl, source: "github", error: null };
  }

  try {
    const url = await fetchWorkerSubscriptionLink(fileName, token);
    console.log(`🔗 ${fileName} 已获取 Worker 订阅链接`);
    return { url, source: "worker", error: null };
  } catch (error) {
    console.warn(
      `⚠️ 获取 ${fileName} 的 Worker 订阅链接失败，已回退到 GitHub 链接:`,
      error,
    );
    addLog(
      "订阅链接",
      `获取 ${fileName} 的 Worker 订阅链接失败，已回退到 GitHub 链接: ${error.message}`,
      "warning",
    );
    if (!workerLinkWarningShown) {
      workerLinkWarningShown = true;
      showNotification(
        "订阅链接回退",
        `Worker 订阅链接获取失败，已使用 GitHub 链接：${error.message}`,
        "warning",
      );
    }
    return { url: fallbackUrl, source: "github", error: error.message };
  }
}

// 通用上传函数，包含SHA重试逻辑
async function uploadToGitHub(
  fileName,
  content,
  isBase64 = false,
  customMessage = "",
  useWorkerSubscriptionLink = true,
) {
  const token = getGithubToken();
  if (!token) {
    throw new Error("缺少GitHub Token，请先在GitHub配置中输入有效的令牌");
  }

  const repo = getGithubRepo();
  if (!repo) {
    throw new Error("GitHub仓库名称不能为空");
  }

  const branch = getGithubBranch();

  // 记录原始操作
  const originalFileName = fileName;
  const isRetry = customMessage.includes("[重试]");
  const retryConfig = getGithubRetryConfig();
  const apiBaseUrl = getGithubApiBaseUrl();
  const apiAccept = getGithubApiAccept();

  // 步骤1: 尝试获取最新的SHA值
  let fileSha = null;
  let retryCount = 0;
  const maxRetries = retryConfig.maxRetries;

  while (retryCount <= maxRetries) {
    try {
      // 清除可能的缓存，使用时间戳
      const timestamp = Date.now();
      const checkUrl = `${apiBaseUrl}/repos/${repo}/contents/${fileName}?ref=${branch}&t=${timestamp}`;

      const checkRes = await fetch(checkUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: apiAccept,
        },
      });

      if (checkRes.ok) {
        const json = await checkRes.json();
        fileSha = json.sha;
        console.log(
          `✅ 获取到 ${fileName} 的最新SHA: ${fileSha.substring(0, 8)}...`,
        );
        break; // 成功获取SHA，退出循环
      } else if (checkRes.status === 404) {
        console.log(`📄 ${fileName} 文件不存在，将创建新文件`);
        fileSha = null;
        break; // 文件不存在，退出循环
      } else {
        const err = await checkRes.json();
        console.warn(
          `⚠️ 获取 ${fileName} SHA 失败(${checkRes.status}):`,
          err.message,
        );

        // 如果是403或429错误，可能是速率限制，等待后重试
        if (
          (checkRes.status === 403 || checkRes.status === 429) &&
          retryCount < maxRetries
        ) {
          retryCount++;
          const waitTime = retryConfig.shaRateLimitDelay * retryCount;
          console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else {
          // 其他错误，抛出异常
          throw new Error(
            `获取文件信息失败: ${err.message || checkRes.statusText}`,
          );
        }
      }
    } catch (e) {
      console.error(`❌ 获取 ${fileName} SHA 时出错:`, e);
      if (retryCount < maxRetries) {
        retryCount++;
        const waitTime = retryConfig.shaErrorDelay * retryCount;
        console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      } else {
        throw e;
      }
    }
  }

  // 步骤2: 准备上传数据
  const defaultMessage = isRetry
    ? `[重试]上传文件 ${fileName} - ${new Date().toLocaleString()}`
    : `上传文件 ${fileName} - ${new Date().toLocaleString()}`;

  const message = customMessage || defaultMessage;

  const body = {
    message: message,
    content: content,
    branch: branch,
  };

  // 只有当文件已存在且有有效的SHA时才添加sha参数
  if (fileSha) {
    body.sha = fileSha;
  }

  // 步骤3: 执行上传
  retryCount = 0;
  while (retryCount <= maxRetries) {
    try {
      const res = await fetch(
        `${apiBaseUrl}/repos/${repo}/contents/${fileName}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: apiAccept,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        const result = await res.json();
        console.log(
          `✅ ${fileName} 上传成功，新SHA: ${result.content.sha.substring(0, 8)}...`,
        );

        // 按用户选择生成链接：
        // worker：Worker 订阅链接（不匹配仓库/失败时回退 Raw）
        // raw/pages：保留原有的纯 GitHub 链接方式
        const linkType = getSelectedLinkType();
        const githubFallbackUrl = buildGithubLink(
          repo,
          branch,
          fileName,
          linkType,
        );

        const subscriptionLink = await resolveSubscriptionLink(
          fileName,
          token,
          githubFallbackUrl,
          useWorkerSubscriptionLink,
          repo,
          linkType,
        );

        return {
          success: true,
          sha: result.content.sha,
          isNew: !fileSha,
          // 保持原字段名，页面统一显示该链接
          githubIoUrl: subscriptionLink.url,
          subscriptionUrl: subscriptionLink.url,
          subscriptionSource: subscriptionLink.source,
          linkType: linkType,
          githubFallbackUrl: githubFallbackUrl,
          workerLinkError: subscriptionLink.error,
        };
      } else {
        const err = await res.json();
        console.error(`❌ ${fileName} 上传失败(${res.status}):`, err);

        // 处理特定的错误类型
        if (
          err.message &&
          err.message.includes("does not match") &&
          retryCount < maxRetries
        ) {
          // SHA不匹配，需要重新获取SHA并重试
          console.log(`⚠️ ${fileName} SHA不匹配，重新获取SHA并重试...`);

          // 强制重新获取SHA（跳过缓存）
          const timestamp = Date.now();
          const retryCheckUrl = `${apiBaseUrl}/repos/${repo}/contents/${fileName}?ref=${branch}&t=${timestamp}&force=true`;

          const retryCheckRes = await fetch(retryCheckUrl, {
            headers: {
              Authorization: `token ${token}`,
              Accept: apiAccept,
            },
          });

          if (retryCheckRes.ok) {
            const retryJson = await retryCheckRes.json();
            body.sha = retryJson.sha; // 更新SHA
            console.log(
              `✅ 重试获取到 ${fileName} 的新SHA: ${retryJson.sha.substring(0, 8)}...`,
            );
          } else {
            // 如果获取失败，可能是文件已被删除，移除SHA尝试创建新文件
            console.log(`📄 ${fileName} 可能已被删除，尝试创建新文件`);
            delete body.sha;
          }

          // 更新消息，标记为重试
          body.message = `[重试]${message}`;

          retryCount++;
          const waitTime =
            retryConfig.uploadShaMismatchDelay * retryCount;
          console.log(`⏳ 等待 ${waitTime}ms 后重试上传...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else if (
          (res.status === 403 || res.status === 429) &&
          retryCount < maxRetries
        ) {
          // GitHub API限制，等待后重试
          retryCount++;
          const waitTime = retryConfig.uploadRateLimitDelay * retryCount;
          console.log(`⏳ GitHub API限制，等待 ${waitTime}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error(
            `${fileName} 上传失败: ${err.message || res.statusText}`,
          );
        }
      }
    } catch (e) {
      console.error(`❌ ${fileName} 上传异常:`, e);
      if (retryCount < maxRetries) {
        retryCount++;
        const waitTime = retryConfig.uploadErrorDelay * retryCount;
        console.log(`⏳ 等待 ${waitTime}ms 后重试上传...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      } else {
        throw e;
      }
    }
  }

  throw new Error(`${fileName} 上传失败，达到最大重试次数`);
}

