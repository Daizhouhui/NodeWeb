      // 清除远程缓存函数
      function clearRemoteCache() {
        data.remoteNodes = [];
        data.optimalSha = null;
        data.locationSha = null;
        displayRemoteVlessLinks();
        updateStats();
        console.log("🗑️ 远程缓存已清除");
        addLog("缓存清理", "远程节点缓存已清除", "info");
      }

      // 初始化上传路径选择
      function initUploadPathSelect() {
        const uploadPathSelect = document.getElementById("uploadPathSelect");
        const customUploadGroup = document.getElementById(
          "customUploadPathGroup",
        );
        const customUploadPath = document.getElementById("customUploadPath");

        uploadPathSelect.addEventListener("change", function () {
          customUploadGroup.classList.toggle("show", this.value === "custom");
          if (this.value !== "custom") {
            customUploadPath.value = "";
            closePathCombobox("customUploadPath");
          }
        });
      }

      // 仓库文件列表缓存：key 为 owner/repo@branch
      const repoFileListCache = new Map();
      const repoFileListRequests = new Map();

      async function fetchRepoFileList() {
        const token = getGithubToken();
        if (!token) {
          throw new Error("请先输入GitHub Token，否则无法读取仓库文件列表");
        }
        const repo = getGithubRepo();
        if (!repo) {
          throw new Error("请先填写GitHub仓库，格式为：用户名/仓库名");
        }
        const branch = getGithubBranch();
        const cacheKey = `${repo}@${branch}`;
        if (repoFileListCache.has(cacheKey)) {
          return repoFileListCache.get(cacheKey);
        }
        if (repoFileListRequests.has(cacheKey)) {
          return repoFileListRequests.get(cacheKey);
        }

        const request = (async () => {
          // 只读取仓库根目录，仅保留不带后缀的文件名
          const url = `${getGithubApiBaseUrl()}/repos/${repo}/contents?ref=${encodeURIComponent(branch)}`;
          const response = await fetch(url, {
            headers: {
              Authorization: `token ${token}`,
              Accept: getGithubApiAccept(),
            },
          });
          if (!response.ok) {
            let message = `读取仓库文件列表失败（HTTP ${response.status}）`;
            try {
              const err = await response.json();
              if (err && err.message) message = err.message;
            } catch (e) {
              // 忽略解析失败
            }
            throw new Error(message);
          }
          const result = await response.json();
          const names = new Set();
          (Array.isArray(result) ? result : []).forEach((item) => {
            if (item.type !== "file" || !item.name) return;
            // 有后缀（含 .gitignore 这类点开头文件）一律不显示
            if (item.name.includes(".")) return;
            names.add(item.name);
          });
          const paths = Array.from(names).sort((a, b) => a.localeCompare(b));
          repoFileListCache.set(cacheKey, paths);
          return paths;
        })();

        repoFileListRequests.set(cacheKey, request);
        try {
          return await request;
        } finally {
          repoFileListRequests.delete(cacheKey);
        }
      }

      // 路径下拉控制器：用于令牌就绪时预加载、切换路径时关闭
      const pathComboboxControllers = new Map();

      function preloadRepoFileLists() {
        if (!getGithubToken()) return;
        pathComboboxControllers.forEach((controller) => {
          controller.preload();
        });
      }

      function closePathCombobox(inputId) {
        const controller = pathComboboxControllers.get(inputId);
        if (controller) controller.close();
      }

      function initRepoFilePreload() {
        const tokenInput = document.getElementById("githubToken");
        if (!tokenInput) return;
        let preloadTimer = null;
        const preloadIfToken = () => {
          clearTimeout(preloadTimer);
          if (!tokenInput.value.trim()) return;
          // 输入令牌时防抖加载，避免每敲一个字符都请求一次
          preloadTimer = setTimeout(preloadRepoFileLists, 600);
        };
        tokenInput.addEventListener("input", preloadIfToken);
        tokenInput.addEventListener("change", preloadIfToken);
      }

      // 自定义路径下拉候选：点击下拉按钮读取仓库文件，输入时实时筛选
      function initPathCombobox(inputId, toggleId, listId) {
        const input = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);
        const list = document.getElementById(listId);
        if (!input || !toggle || !list) return;

        // 挂到 body，使用 fixed 定位，避免撑出卡片内部滚动条
        document.body.appendChild(list);

        let allPaths = [];
        let loading = false;
        let loadError = "";
        let loadedKey = "";
        let hasLoaded = false;

        const getRepoKey = () => `${getGithubRepo()}@${getGithubBranch()}`;

        const render = () => {
          const keyword = input.value.trim().toLowerCase();
          list.innerHTML = "";

          if (loading) {
            const tip = document.createElement("div");
            tip.className = "path-combobox-empty";
            tip.textContent = "正在读取仓库文件列表...";
            list.appendChild(tip);
            return;
          }

          if (loadError) {
            const tip = document.createElement("div");
            tip.className = "path-combobox-empty";
            tip.textContent = loadError;
            list.appendChild(tip);
            return;
          }

          const matched = (
            keyword
              ? allPaths.filter((path) =>
                  path.toLowerCase().includes(keyword),
                )
              : allPaths
          ).slice(0, 300);

          if (matched.length === 0) {
            const tip = document.createElement("div");
            tip.className = "path-combobox-empty";
            tip.textContent = keyword
              ? "没有匹配的文件，可直接输入路径"
              : "仓库中没有可选择的文件";
            list.appendChild(tip);
            return;
          }

          matched.forEach((path) => {
            const option = document.createElement("div");
            option.className = "path-combobox-option";
            option.textContent = path;
            option.addEventListener("click", (event) => {
              event.preventDefault();
              input.value = path;
              close();
            });
            list.appendChild(option);
          });
        };

        const open = () => {
          const rect = input
            .closest(".path-combobox")
            .getBoundingClientRect();
          const width = rect.width;
          const left = Math.max(
            8,
            Math.min(rect.left, window.innerWidth - width - 8),
          );
          const spaceBelow = window.innerHeight - rect.bottom - 8;
          const spaceAbove = rect.top - 8;

          list.style.width = `${width}px`;
          list.style.left = `${left}px`;
          list.style.top = "auto";
          list.style.bottom = "auto";

          if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
            list.style.top = `${rect.bottom + 6}px`;
            list.style.maxHeight = `${Math.max(
              80,
              Math.min(240, spaceBelow - 6),
            )}px`;
          } else {
            list.style.bottom = `${window.innerHeight - rect.top + 6}px`;
            list.style.maxHeight = `${Math.max(
              80,
              Math.min(240, spaceAbove - 6),
            )}px`;
          }

          list.classList.add("show");
          toggle.setAttribute("aria-expanded", "true");
        };

        const close = () => {
          list.classList.remove("show");
          toggle.setAttribute("aria-expanded", "false");
        };

        window.addEventListener("resize", close);
        document.addEventListener(
          "scroll",
          (event) => {
            if (list.contains(event.target)) return;
            close();
          },
          true,
        );

        const ensureLoaded = async (silent = false) => {
          if (loading) return;
          const repoKey = getRepoKey();
          if (repoKey !== loadedKey) {
            allPaths = [];
            loadError = "";
            hasLoaded = false;
          }
          if (hasLoaded && !loadError) {
            loadedKey = repoKey;
            render();
            return;
          }
          loading = true;
          loadError = "";
          render();
          try {
            allPaths = await fetchRepoFileList();
            loadedKey = repoKey;
            hasLoaded = true;
          } catch (e) {
            loadError = e.message || String(e);
            loadedKey = repoKey;
            if (!silent) {
              showNotification("读取文件列表失败", loadError, "error");
            }
          } finally {
            loading = false;
            render();
          }
        };

        pathComboboxControllers.set(inputId, {
          preload: () => ensureLoaded(true),
          close,
        });

        toggle.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (list.classList.contains("show") && !loadError) {
            close();
            return;
          }
          open();
          if (
            !hasLoaded ||
            loadError ||
            loadedKey !== getRepoKey()
          ) {
            await ensureLoaded();
          } else {
            render();
          }
        });

        input.addEventListener("input", async () => {
          open();
          if (loading) return;
          if (loadedKey !== getRepoKey() || (!hasLoaded && !loadError)) {
            await ensureLoaded();
          } else {
            render();
          }
        });

        input.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            close();
          }
        });

        document.addEventListener("click", (event) => {
          if (
            !list.contains(event.target) &&
            event.target !== toggle &&
            event.target !== input
          ) {
            close();
          }
        });
      }

      // 更新CSV输入框状态
      function updateCSVInputState() {
        const csvInput = document.getElementById("csvInput");
        const pasteTabBtn = document.querySelector(
          '.card-tab-btn[data-tab="paste-tab"]',
        );

        if (data.currentSource === "file") {
          // 有文件上传时，禁用粘贴输入框
          csvInput.disabled = true;
          csvInput.placeholder = "已上传文件，粘贴功能已禁用。请先移除文件。";
          pasteTabBtn.style.opacity = "0.6";
          pasteTabBtn.style.cursor = "not-allowed";
        } else {
          // 没有文件上传时，启用粘贴输入框
          csvInput.disabled = false;
          csvInput.placeholder =
            "支持多种格式，智能分割：\n1. 单行或多行格式（冒号,逗号，空格分隔）：\n2. 紧凑格式（一行多个）：\n3. 混合分隔符：\n4. 只有IP（使用默认端口）：";
          pasteTabBtn.style.opacity = "1";
          pasteTabBtn.style.cursor = "pointer";
        }
      }

      // 初始化标签页 - 修复：确保每个卡片的标签页独立
      function initTabs() {
        // 为每个卡片的标签页分别初始化
        const cards = document.querySelectorAll(".card");
        cards.forEach((card) => {
          const tabButtons = card.querySelectorAll(".card-tab-btn");
          if (tabButtons.length > 0) {
            tabButtons.forEach((button) => {
              button.addEventListener("click", (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                const cardBody = button.closest(".card-body");
                const tabId = button.getAttribute("data-tab");

                // 只在当前卡片内部切换
                const allTabBtns = cardBody.querySelectorAll(".card-tab-btn");
                const allTabContents =
                  cardBody.querySelectorAll(".card-tab-content");

                allTabBtns.forEach((btn) => btn.classList.remove("active"));
                allTabContents.forEach((content) =>
                  content.classList.remove("active"),
                );

                button.classList.add("active");
                const targetTab = cardBody.querySelector(`#${tabId}`);
                if (targetTab) {
                  targetTab.classList.add("active");
                }
              });
            });
          }
        });
      }

      // 初始化折叠面板
      function initAccordion() {
        const accordionToggle = document.getElementById("advancedConfigToggle");
        const accordionContent = document.getElementById(
          "advancedConfigContent",
        );

        accordionToggle.addEventListener("click", () => {
          accordionToggle.classList.toggle("active");
          accordionContent.classList.toggle("show");
        });
      }

      // 初始化标题显示/隐藏
      function initThemeToggle() {
        const root = document.documentElement;
        const stylesheet = document.getElementById("darkThemeStylesheet");
        const toggleBtn = document.getElementById("themeToggleBtn");
        const toggleIcon = document.getElementById("themeToggleIcon");
        const toggleLabel = document.getElementById("themeToggleLabel");
        const themeConfig = getWebConfig().theme || {};
        const themes = Array.isArray(themeConfig.list)
          ? themeConfig.list
          : [];
        if (!themes.length) return;

        let activeThemeIndex = Math.max(
          0,
          themes.findIndex((theme) => theme.id === root.dataset.theme),
        );

        function updateThemeControl() {
          const currentTheme = themes[activeThemeIndex];
          const nextTheme = themes[(activeThemeIndex + 1) % themes.length];
          toggleBtn.setAttribute("aria-pressed", String(currentTheme.dark));
          toggleBtn.setAttribute(
            "aria-label",
            `当前样式：${currentTheme.name}，点击切换到${nextTheme.name}`,
          );
          toggleIcon.textContent = currentTheme.icon;
          toggleLabel.textContent = `样式：${currentTheme.name}`;
        }

        updateThemeControl();
        initMobileThemeButtonDrag(toggleBtn);
        toggleBtn.addEventListener("click", () => {
          if (toggleBtn.dataset.dragged === "true") {
            delete toggleBtn.dataset.dragged;
            return;
          }

          activeThemeIndex = (activeThemeIndex + 1) % themes.length;
          const theme = themes[activeThemeIndex];
          root.dataset.theme = theme.id;
          stylesheet.disabled = !theme.dark;
          updateThemeControl();

          try {
            localStorage.setItem(
              themeConfig.storageKey || "vless-node-theme-v2",
              theme.id,
            );
          } catch (error) {
            console.warn("保存主题偏好失败", error);
          }
        });
      }

      function initMobileThemeButtonDrag(toggleBtn) {
        const quickActions = toggleBtn.parentElement;
        const themeConfig = getWebConfig().theme || {};
        const dragPositionKey =
          themeConfig.dragPositionStorageKey ||
          "vless-node-theme-button-position-v1";
        const mobileBreakpoint =
          Number(themeConfig.mobileBreakpoint) > 0
            ? Number(themeConfig.mobileBreakpoint)
            : 768;
        const mobileViewport = window.matchMedia(
          `(max-width: ${mobileBreakpoint}px)`,
        );
        let dragStart = null;
        let dragged = false;

        function clampPosition(left, top) {
          const buttonRect = toggleBtn.getBoundingClientRect();
          return {
            left: Math.max(0, Math.min(left, window.innerWidth - buttonRect.width)),
            top: Math.max(0, Math.min(top, window.innerHeight - buttonRect.height)),
          };
        }

        function setPosition(left, top) {
          const position = clampPosition(left, top);
          quickActions.style.left = `${position.left}px`;
          quickActions.style.top = `${position.top}px`;
          quickActions.style.right = "auto";
          quickActions.style.bottom = "auto";
          return position;
        }

        if (mobileViewport.matches) {
          try {
            const savedPosition = JSON.parse(
              localStorage.getItem(dragPositionKey) || "null",
            );
            if (
              savedPosition &&
              Number.isFinite(savedPosition.left) &&
              Number.isFinite(savedPosition.top)
            ) {
              setPosition(savedPosition.left, savedPosition.top);
            }
          } catch (error) {
            console.warn("读取主题按钮位置失败", error);
          }
        }

        toggleBtn.addEventListener("pointerdown", (event) => {
          if (!mobileViewport.matches || event.button !== 0) return;

          const rect = toggleBtn.getBoundingClientRect();
          dragStart = {
            pointerId: event.pointerId,
            pointerX: event.clientX,
            pointerY: event.clientY,
            left: rect.left,
            top: rect.top,
          };
          dragged = false;
          toggleBtn.setPointerCapture(event.pointerId);
        });

        toggleBtn.addEventListener("pointermove", (event) => {
          if (!dragStart || event.pointerId !== dragStart.pointerId) return;

          const deltaX = event.clientX - dragStart.pointerX;
          const deltaY = event.clientY - dragStart.pointerY;
          if (!dragged && Math.hypot(deltaX, deltaY) < 6) return;

          dragged = true;
          event.preventDefault();
          const position = setPosition(
            dragStart.left + deltaX,
            dragStart.top + deltaY,
          );
          toggleBtn.dataset.dragged = "true";
          try {
            localStorage.setItem(dragPositionKey, JSON.stringify(position));
          } catch (error) {
            console.warn("保存主题按钮位置失败", error);
          }
        });

        function finishDrag(event) {
          if (!dragStart || event.pointerId !== dragStart.pointerId) return;
          if (toggleBtn.hasPointerCapture(event.pointerId)) {
            toggleBtn.releasePointerCapture(event.pointerId);
          }
          dragStart = null;
        }

        toggleBtn.addEventListener("pointerup", finishDrag);
        toggleBtn.addEventListener("pointercancel", finishDrag);
        window.addEventListener("resize", () => {
          if (!mobileViewport.matches || !quickActions.style.top) return;
          const rect = toggleBtn.getBoundingClientRect();
          setPosition(rect.left, rect.top);
        });
      }

      function initHeaderToggle() {
        const toggleBtn = document.getElementById("toggleHeaderBtn");
        const headerInfo = document.getElementById("headerInfo");

        toggleBtn.addEventListener("click", () => {
          if (headerInfo.classList.contains("hidden")) {
            headerInfo.classList.remove("hidden");
            toggleBtn.textContent = "隐藏";
            // showNotification('提示', '标题已显示', 'info');
          } else {
            headerInfo.classList.add("hidden");
            toggleBtn.textContent = "显示";
            // showNotification('提示', '标题已隐藏', 'info');
          }
        });
      }

      function initDragDrop() {
        const area = document.getElementById("dropArea");

        // 修复：确保拖拽功能正常工作
        ["dragenter", "dragover"].forEach((e) => {
          area.addEventListener(e, (event) => {
            event.preventDefault();
            event.stopPropagation();
            area.classList.add("dragover");
          });
        });

        ["dragleave", "drop"].forEach((e) => {
          area.addEventListener(e, (event) => {
            event.preventDefault();
            event.stopPropagation();
            area.classList.remove("dragover");
          });
        });

        // 修复：正确处理drop事件，支持多个文件
        area.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            /\.(csv|txt)$/i.test(f.name),
          );
          if (files && files.length > 0) {
            handleFiles(files);
          }
        });

        area.addEventListener("click", () =>
          document.getElementById("fileInput").click(),
        );
      }

      // 新增：处理多个文件的函数
      async function handleFiles(files) {
        // 筛选有效的CSV/TXT文件
        const validFiles = files.filter((f) => /\.(csv|txt)$/i.test(f.name));

        if (validFiles.length === 0) {
          showNotification("文件错误", "请上传CSV或TXT文件", "error");
          addLog("文件操作", "未找到有效的CSV/TXT文件", "error");
          return;
        }

        const fileInput = document.getElementById("fileInput");
        const dataTransfer = new DataTransfer();
        validFiles.forEach((file) => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
        data.csvColumnDetection.detected = false;

        // 存储已上传的文件列表
        if (!data.uploadedFiles) {
          data.uploadedFiles = [];
        }
        data.uploadedFiles = validFiles;

        // 更新UI显示已上传文件信息
        const fileNameEl = document.getElementById("fileName");
        const fileSizeEl = document.getElementById("fileSize");

        if (validFiles.length === 1) {
          fileNameEl.textContent = validFiles[0].name;
          fileSizeEl.textContent = formatSize(validFiles[0].size);
        } else {
          const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
          fileNameEl.textContent = `已上传 ${validFiles.length} 个文件`;
          fileSizeEl.textContent = `(总大小: ${formatSize(totalSize)})`;
        }

        document.getElementById("fileInfo").classList.add("show");
        document.getElementById("dropArea").classList.add("has-file");
        document.getElementById("csvInput").value = "";
        data.currentSource = "file";
        updateSourceBadge();
        updateCSVInputState();

        // 读取所有文件并合并内容
        let combinedContent = "";
        let fileCount = 0;
        let errorCount = 0;
        let headerLine = ""; // 存储第一个有效的header行

        for (const file of validFiles) {
          try {
            const content = await readFileAsText(file);
            const lines = content.split(/\r?\n/);

            if (lines.length === 0) continue;

            if (!combinedContent) {
              // 第一个文件：完整保留
              combinedContent = content;
              headerLine = lines[0]; // 保存header行
            } else {
              // 后续文件：尝试移除header行，但保留所有数据行
              // 通过检查第一行是否看起来像header来决定是否跳过
              let skipFirstLine = false;
              if (lines.length > 1) {
                const firstLine = lines[0].toLowerCase();
                // 检查是否看起来像header（包含IP、port、city等关键词）
                const headerKeywords = [
                  "ip",
                  "host",
                  "address",
                  "port",
                  "city",
                  "country",
                  "region",
                  "speed",
                  "地址",
                  "端口",
                  "城市",
                  "国家",
                  "地区",
                  "速度",
                ];
                const keywordCount = headerKeywords.filter((kw) =>
                  firstLine.includes(kw),
                ).length;
                if (keywordCount >= 1) {
                  skipFirstLine = true;
                }
              }

              // 添加非header的行
              const dataLinesToAdd = skipFirstLine ? lines.slice(1) : lines;
              if (dataLinesToAdd.length > 0) {
                combinedContent += "\n" + dataLinesToAdd.join("\n");
              }
            }
            fileCount++;
          } catch (e) {
            errorCount++;
            addLog("文件操作", `文件读取失败: ${file.name}`, "error");
          }
        }

        // 将合并的内容设置到csvInput（用于解析）
        document.getElementById("csvInput").value = combinedContent;

        // 等待列检测完成，避免生成时使用上一次文件的列配置。
        const columnsDetected = await new Promise((resolve) =>
          autoDetectCSVColumns(validFiles[0], resolve),
        );
        if (columnsDetected) {
          await generateVless();
        }

        const message =
          validFiles.length === 1
            ? `成功上传文件: ${validFiles[0].name}`
            : `成功上传 ${fileCount} 个文件${errorCount > 0 ? `，${errorCount} 个失败` : ""}`;
        addLog("文件操作", message, "success");
        showNotification("上传成功", message, "success");
      }

      // 新增：异步读取文件为文本
      function readFileAsText(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
      }

      function handleFile(file) {
        if (!/\.(csv|txt)$/i.test(file.name)) {
          showNotification(
            "文件错误",
            "请上传CSV或TXT文件，当前文件格式不支持",
            "error",
          );
          addLog("文件操作", `文件格式错误: ${file.name}`, "error");
          return;
        }

        // 修复：确保文件被正确设置到fileInput元素
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById("fileInput").files = dataTransfer.files;

        const reader = new FileReader();
        reader.onload = (e) => {
          data.currentSource = "file";
          document.getElementById("fileName").textContent = file.name;
          document.getElementById("fileSize").textContent = formatSize(
            file.size,
          );
          document.getElementById("fileInfo").classList.add("show");
          document.getElementById("dropArea").classList.add("has-file");
          document.getElementById("csvInput").value = "";
          updateSourceBadge();
          // 更新CSV输入框状态
          updateCSVInputState();

          // 文件上传后自动进行列检测
          autoDetectCSVColumns();

          // 修复：文件上传后自动生成节点
          setTimeout(() => {
            generateVless();
          }, 100);

          addLog("文件操作", `成功上传文件: ${file.name}`, "success");
        };
        reader.onerror = (e) => {
          showNotification(
            "文件读取失败",
            "无法读取文件内容，请检查文件是否损坏或重新上传",
            "error",
          );
          addLog(
            "文件操作",
            `文件读取失败: ${file.name} - ${e.message}`,
            "error",
          );
        };
        reader.readAsText(file);
      }

      function removeFile() {
        data.currentSource = "none";
        data.uploadedFiles = []; // 清除已上传文件列表
        document.getElementById("fileInfo").classList.remove("show");
        document.getElementById("dropArea").classList.remove("has-file");
        document.getElementById("fileInput").value = "";
        document.getElementById("fileName").textContent = "";
        document.getElementById("fileSize").textContent = "";
        updateSourceBadge();
        // 更新CSV输入框状态
        updateCSVInputState();

        // 清除检测结果
        document.getElementById("columnDetectionResult").style.display = "none";

        addLog("文件操作", "已移除上传的文件", "info");

        // 清空生成结果
        data.vlessLinks = [];
        data.localBase64Content = "";
        data.localYamlContent = "";
        data.autoBase64Content = "";
        data.mergedYamlContent = "";
        displayVlessLinks();
        document.getElementById("localBase64Output").textContent =
          "Base64订阅内容将在这里显示...";
        document.getElementById("localBase64Output").classList.add("empty");
        document.getElementById("localYamlOutput").textContent =
          "本地YAML配置将在这里显示...";
        document.getElementById("localYamlOutput").classList.add("empty");
        document.getElementById("autoBase64Output").textContent =
          "合并去重后将自动生成Base64订阅内容...";
        document.getElementById("autoBase64Output").classList.add("empty");
        document.getElementById("mergedYamlOutput").textContent =
          "合并后的YAML配置将在这里显示...";
        document.getElementById("mergedYamlOutput").classList.add("empty");
        updateStats();
      }

      function updateSourceBadge() {
        const badge = document.getElementById("sourceBadge");
        if (data.currentSource === "file") {
          const fileCount = data.uploadedFiles ? data.uploadedFiles.length : 1;
          badge.textContent =
            fileCount > 1 ? `已上传${fileCount}个文件` : "已上传文件";
        } else if (data.currentSource === "direct") {
          badge.textContent = "Vless直链";
        } else {
          badge.textContent = "粘贴内容";
        }
      }

      function getDirectVlessLinks() {
        const input = document.getElementById("vlessDirectInput").value;
        const links = input
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith("vless://"));
        return [...new Set(links)];
      }

      function syncHostAndSni(source, value) {
        const target = source === "host" ? "sni" : "host";
        document.getElementById(source).value = value;
        document.getElementById(target).value = value;
      }

      function updateDirectVlessConfig(link, config) {
        const url = new URL(link);
        if (url.protocol !== "vless:" || !url.username || !url.hostname) {
          throw new Error("Vless链接格式无效");
        }

        url.username = config.uuid;
        url.searchParams.set("host", config.host);
        url.searchParams.set("sni", config.sni);
        url.searchParams.set("path", config.customPath);
        if (url.searchParams.has("ech")) {
          if (config.ech) {
            url.searchParams.set("ech", config.ech);
          } else {
            url.searchParams.delete("ech");
          }
        }
        return url.toString();
      }

      function loadVlessDirect() {
        const links = getDirectVlessLinks();
        const input = document.getElementById("vlessDirectInput").value;
        const invalidLines = input
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("vless://"));

        if (links.length === 0) {
          showNotification(
            "载入失败",
            "请粘贴至少一条以 vless:// 开头的直链",
            "error",
          );
          return;
        }

        data.currentSource = "direct";
        data.vlessLinks = links;
        data.uniqueNodes = [];
        data.stats.local = links.length;
        data.stats.merged = 0;
        data.stats.unique = 0;
        data.localBase64Content = utf8ToBase64(links.join("\n"));
        data.localYamlContent = generateClashYAML(links);
        data.cache.lastLocalGeneration = Date.now();

        document.getElementById("localBase64Output").textContent =
          data.localBase64Content;
        document.getElementById("localBase64Output").classList.remove("empty");
        document.getElementById("localYamlOutput").textContent =
          data.localYamlContent;
        document.getElementById("localYamlOutput").classList.remove("empty");
        updateSourceBadge();
        displayVlessLinks();
        updateStats();

        const warning =
          invalidLines.length > 0
            ? `，已忽略 ${invalidLines.length} 行非Vless内容`
            : "";
        showNotification(
          "直链载入成功",
          `已载入 ${links.length} 个Vless直链${warning}`,
          "success",
        );
        addLog(
          "载入Vless直链",
          `成功载入 ${links.length} 个原始Vless直链`,
          "success",
        );
      }

      function clearVlessDirect() {
        document.getElementById("vlessDirectInput").value = "";
        if (data.currentSource === "direct") {
          data.currentSource = "none";
          data.vlessLinks = [];
          data.localBase64Content = "";
          data.localYamlContent = "";
          displayVlessLinks();
          updateSourceBadge();
          updateStats();
        }
      }

