      async function generateVless() {
        showLoading(true, "generateBtn");
        try {
          const config = getConfig();

          const text =
            data.currentSource === "direct"
              ? document.getElementById("vlessDirectInput").value.trim()
              : document.getElementById("csvInput").value.trim();

          if (!text) {
            showNotification(
              "生成节点失败",
              data.currentSource === "direct"
                ? "请先粘贴Vless直链"
                : "请提供CSV数据，可以上传文件或粘贴内容",
              "error",
            );
            showLoading(false, "generateBtn");
            return;
          }

          data.vlessLinks = await parseAndGenerate(text, config);
          data.stats.local = data.vlessLinks.length;
          data.cache.lastLocalGeneration = Date.now();

          // 自动生成本地Base64
          if (data.vlessLinks.length > 0) {
            data.localBase64Content = utf8ToBase64(data.vlessLinks.join("\n"));
            // 生成对应的本地YAML内容
            data.localYamlContent = generateClashYAML(data.vlessLinks);
            document.getElementById("localBase64Output").textContent =
              data.localBase64Content;
            document
              .getElementById("localBase64Output")
              .classList.remove("empty");
            document.getElementById("localYamlOutput").textContent =
              data.localYamlContent;
            document
              .getElementById("localYamlOutput")
              .classList.remove("empty");
          }

          displayVlessLinks();
          updateStats();

          // 智能检查：如果已有远程节点缓存，自动提示合并
          if (
            data.remoteNodes.length > 0 ||
            data.cache.remoteNodes.length > 0
          ) {
            // 如果远程节点为空但缓存中有数据，恢复缓存
            if (
              data.remoteNodes.length === 0 &&
              data.cache.remoteNodes.length > 0
            ) {
              data.remoteNodes = [...data.cache.remoteNodes];
              data.stats.remote = data.remoteNodes.length;
              displayRemoteVlessLinks();
              updateStats();
            }

            // 显示合并提示
            setTimeout(() => {
              showNotification(
                "提示",
                `已生成 ${data.vlessLinks.length} 个本地节点，检测到 ${data.remoteNodes.length} 个远程节点，点击"合并节点"按钮进行合并`,
                "info",
              );
            }, 500);
          }

          showNotification(
            "节点生成成功",
            `成功生成 ${data.vlessLinks.length} 个Vless节点，并自动生成Base64订阅`,
            "success",
          );
          addLog(
            "生成节点",
            `成功生成 ${data.vlessLinks.length} 个Vless节点`,
            "success",
          );
        } catch (e) {
          showNotification(
            "节点生成失败",
            "生成过程中发生错误: " + e.message,
            "error",
          );
          addLog("生成节点", "生成失败: " + e.message, "error");
        } finally {
          showLoading(false, "generateBtn");
        }
      }

      function getConfig() {
        const readColumnIndex = (id, fallback) => {
          const displayedIndex = Number.parseInt(
            document.getElementById(id).value,
            10,
          );
          if (displayedIndex === -1) return -1;
          if (Number.isInteger(displayedIndex) && displayedIndex >= 1) {
            return displayedIndex - 1;
          }
          return fallback;
        };

        const vlessDefaults = getVlessDefaults();
        return {
          uuid:
            document.getElementById("uuid").value.trim() ||
            vlessDefaults.uuid ||
            "",
          host:
            document.getElementById("host").value || vlessDefaults.host || "",
          sni: document.getElementById("sni").value || vlessDefaults.sni || "",
          customPath:
            document.getElementById("customPath").value.trim() ||
            vlessDefaults.path ||
            "",
          ech:
            document.getElementById("ech").value.trim() ||
            vlessDefaults.ech ||
            "",
          fp:
            document.getElementById("fp").value.trim() ||
            vlessDefaults.fp ||
            "chrome",
          force443: document.getElementById("forcePort443").checked,
          defaultPort:
            parseInt(document.getElementById("defaultPort").value) ||
            vlessDefaults.port ||
            443,
          prefix:
            document.getElementById("remarksPrefix").value.trim() ||
            vlessDefaults.prefix ||
            "自选",
          autoLoc: document.getElementById("autoLocation").checked,
          useCsvInfo: document.getElementById("useCsvInfo").checked,
          showSequence:
            document.getElementById("aliasShowSequence").checked,
          showSpeed: document.getElementById("aliasShowSpeed").checked,
          ipColumn: readColumnIndex("ipColumn", 0),
          portColumn: readColumnIndex("portColumn", -1),
          cityColumn: readColumnIndex("cityColumn", -1),
          countryColumn: readColumnIndex("countryColumn", -1),
          regionColumn: readColumnIndex("regionColumn", -1),
          speedColumn: readColumnIndex("speedColumn", -1),
        };
      }

      async function parseAndGenerate(text, config) {
        if (data.currentSource === "direct") {
          return getDirectVlessLinks().map((link) =>
            updateDirectVlessConfig(link, config),
          );
        }
        // 如果是文件上传的CSV，尝试解析完整CSV
        if (data.currentSource === "file") {
          return await parseCSVFile(text, config);
        } else {
          // 如果是粘贴内容，使用智能分割
          return await parsePasteText(text, config);
        }
      }

      function findChineseMapping(value, mapping) {
        if (typeof value !== "string") return "";
        const normalizedValue = value.trim();
        if (!normalizedValue) return "";

        if (Object.prototype.hasOwnProperty.call(mapping, normalizedValue)) {
          return mapping[normalizedValue];
        }

        const uppercaseValue = normalizedValue.toUpperCase();
        if (Object.prototype.hasOwnProperty.call(mapping, uppercaseValue)) {
          return mapping[uppercaseValue];
        }

        const matchingKey = Object.keys(mapping).find(
          (key) => key.toLowerCase() === normalizedValue.toLowerCase(),
        );
        return matchingKey ? mapping[matchingKey] : "";
      }

      function getChineseLocationName(value) {
        return (
          findChineseMapping(value, countryNameToChinese) ||
          findChineseMapping(value, regionCodeToChinese)
        );
      }

      // 解析CSV文件 - 修复别名生成逻辑
      // 解析CSV文件 - 修复别名生成逻辑，按照需求1生成别名
      async function parseCSVFile(text, config) {
        const nodes = [];
        const regionGroups = {};
        const lines = text.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length === 0) return [];

        // 检查是否有标题行
        let hasHeader = data.csvColumnDetection.detected
          ? data.csvColumnDetection.hasHeader
          : false;
        if (!data.csvColumnDetection.detected) {
          // 如果没有检测过，进行简单检测
          const firstLine = lines[0].toLowerCase();
          hasHeader =
            firstLine.includes("ip") ||
            firstLine.includes("host") ||
            firstLine.includes("port") ||
            firstLine.includes("地址") ||
            firstLine.includes("端口");
        }

        let startIndex = hasHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            const row = parseCSVLine(line);

            // 获取IP和端口 - 改进：先从配置的列提取，如果失败则自动扫描行中的IP和端口
            let ip = "";
            let port = config.defaultPort;
            let foundIP = false;

            // 优先从指定列获取IP
            if (config.ipColumn >= 0 && config.ipColumn < row.length) {
              const cellValue = row[config.ipColumn].trim();
              if (isValidAddress(cellValue) || cellValue.includes(":")) {
                ip = cellValue;
                foundIP = true;
              }
            }

            // 如果从指定列没有找到有效IP，则自动扫描行中的所有单元格查找IP
            if (!foundIP) {
              for (let j = 0; j < row.length; j++) {
                const cellValue = row[j].trim();
                if (isValidAddress(cellValue)) {
                  ip = cellValue;
                  foundIP = true;
                  break;
                }
                // 新增：检查是否是方括号IPv6:端口格式 [::1]:443
                if (cellValue.startsWith("[") && cellValue.includes("]:")) {
                  const closeBracket = cellValue.indexOf("]");
                  const addr = cellValue.substring(1, closeBracket);
                  if (isValidIPv6(addr)) {
                    ip = addr;
                    foundIP = true;
                    break;
                  }
                }
                // 检查是否是IP:端口格式（仅IPv4或域名）
                if (
                  cellValue.includes(":") &&
                  cellValue.split(":").length === 2
                ) {
                  const parts = cellValue.split(":");
                  if (isValidAddress(parts[0]) && !isValidIPv6(parts[0])) {
                    ip = cellValue;
                    foundIP = true;
                    break;
                  }
                }
              }
            }

            // 处理IP中包含的端口（仅IPv4或域名的 ip:port 格式，IPv6已经单独处理）
            if (!isValidIPv6(ip) && ip.includes(":")) {
              const parts = ip.split(":");
              ip = parts[0];
              if (parts.length > 1) {
                const portStr = parts[1];
                if (portStr && /^\d{1,5}$/.test(portStr)) {
                  port = parseInt(portStr) || config.defaultPort;
                }
              }
            }

            // 优先从指定列获取端口
            if (config.portColumn >= 0 && config.portColumn < row.length) {
              const portStr = row[config.portColumn].trim();
              if (portStr && /^\d{1,5}$/.test(portStr)) {
                const parsedPort = parseInt(portStr);
                if (parsedPort >= 1 && parsedPort <= 65535) {
                  port = parsedPort;
                }
              }
            } else if (!foundIP || port === config.defaultPort) {
              // 如果还没有找到端口，或者没有通过ipColumn找到IP，则自动扫描行中的所有单元格查找端口
              for (let j = 0; j < row.length; j++) {
                const cellValue = row[j].trim();
                if (/^\d{1,5}$/.test(cellValue)) {
                  const parsedPort = parseInt(cellValue);
                  if (parsedPort >= 1 && parsedPort <= 65535) {
                    // 检查这个数字是否看起来像端口（常见端口或在合理范围内）
                    const commonPorts = [
                      80, 443, 8080, 8443, 22, 21, 25, 53, 3306, 5432, 6379,
                      27017, 2087, 2053, 2083, 8443,
                    ];
                    if (commonPorts.includes(parsedPort) || parsedPort > 1024) {
                      port = parsedPort;
                      break;
                    }
                  }
                }
              }
            }

            // 验证地址有效性（支持IPv4/IPv6/域名）
            if (!isValidAddress(ip)) {
              continue;
            }

            // 强制使用443端口（如果勾选了此选项）
            if (config.force443) {
              port = 443;
            }

            // 获取CSV中的信息用于生成别名
            let city = "";
            let country = "";
            let region = "";
            let speed = "";

            // 从指定列获取各字段 - 改进：如果指定列无效则尝试自动查找
            if (config.cityColumn >= 0 && config.cityColumn < row.length) {
              city = row[config.cityColumn].trim();
            } else {
              // 自动查找城市列：查找非IP、非端口的文本单元格
              for (let j = 0; j < row.length; j++) {
                const cellValue = row[j].trim();
                // 跳过IP和端口
                if (
                  isValidAddress(cellValue) ||
                  (cellValue.includes(":") &&
                    isValidAddress(cellValue.split(":")[0]))
                )
                  continue;
                if (
                  /^\d{1,5}$/.test(cellValue) &&
                  parseInt(cellValue) >= 1 &&
                  parseInt(cellValue) <= 65535
                )
                  continue;
                // 如果找到文本，认为是城市
                if (
                  cellValue &&
                  !/^[\d\-\.]+$/.test(cellValue) &&
                  !isSpeedValue(cellValue) &&
                  !isDelayValue(cellValue)
                ) {
                  city = cellValue;
                  break;
                }
              }
            }

            if (
              config.countryColumn >= 0 &&
              config.countryColumn < row.length
            ) {
              country = row[config.countryColumn].trim();
            }

            if (config.regionColumn >= 0 && config.regionColumn < row.length) {
              region = row[config.regionColumn].trim();
            }

            if (config.speedColumn >= 0 && config.speedColumn < row.length) {
              speed = row[config.speedColumn].trim();
              // 提取速度数值
              const speedMatch = speed.match(/(\d+(\.\d+)?)/);
              if (speedMatch) {
                speed = `${speedMatch[1]}MB/s`;
              }
            } else {
              // 自动查找速度列
              for (let j = 0; j < row.length; j++) {
                const cellValue = row[j].trim();
                if (isSpeedValue(cellValue)) {
                  const speedMatch = cellValue.match(/(\d+(\.\d+)?)/);
                  if (speedMatch) {
                    speed = `${speedMatch[1]}MB/s`;
                  }
                  break;
                }
              }
            }

            // 解析CSV地名字段(城市/国家/地区码)为别名所需的首段与第二段
            // 别名第二段统一用国家名;香港/澳门/新加坡/中国大陆城市只显示单名
            let location = { main: "", sub: "" };
            if (config.useCsvInfo) {
              location = resolveLocationAlias({ city, country, region });
            }

            // 确定首段地名;CSV无地名信息时回退IP检测(IPv6和域名使用默认名称)
            let isUnknownRegion = false;
            if (!location.main) {
              const addrType = getAddressType(ip);
              if (addrType === "ipv6") {
                location.main = "IPv6节点";
                isUnknownRegion = true;
              } else if (addrType === "domain") {
                location.main = "域名节点";
                isUnknownRegion = true;
              } else {
                const detectedLocation = await getLocationCached(ip);
                if (detectedLocation !== "未知") {
                  location.main = detectedLocation;
                } else {
                  location.main = config.prefix;
                  isUnknownRegion = true;
                }
              }
            }

            // 初始化地区组(序号按首段地名分组)
            if (!regionGroups[location.main]) {
              regionGroups[location.main] = {
                nodes: [],
                counter: 1,
              };
            }

            // 为当前节点生成序号
            const sequence = regionGroups[location.main].counter++;

            // 生成别名:地名(序号)-国家/地区-(速度)-端口-IP
            // 序号与速度默认关闭(节点配置中可开启);获取不到地区的节点始终带序号
            const remark = buildNodeAlias({
              name: location.main,
              sub: location.sub,
              sequence: sequence,
              showSequence: config.showSequence,
              alwaysSequence: isUnknownRegion,
              showSpeed: config.showSpeed,
              speed: speed,
              port: port,
              address: shortenAddressForAlias(ip),
            });

            // 保存节点信息
            regionGroups[location.main].nodes.push({
              ip: ip,
              port: port,
              remark: remark,
              config: config,
            });
          } catch (e) {
            console.warn(`解析CSV行失败: ${line}`, e);
          }
        }

        // 生成所有节点
        Object.keys(regionGroups).forEach((regionName) => {
          regionGroups[regionName].nodes.forEach((node) => {
            nodes.push(
              generateLink(node.ip, node.port, node.config, node.remark),
            );
          });
        });

        console.log(
          `CSV解析完成：生成 ${nodes.length} 个节点，按 ${Object.keys(regionGroups).length} 个地区分组`,
        );
        return nodes;
      }

      // 新增：从CSV信息生成别名（根据需求1）
      async function generateRemarkFromCSV(
        ip,
        port,
        city,
        country,
        region,
        speed,
        config,
      ) {
        // 如果不使用CSV信息，使用默认方式
        if (!config.useCsvInfo) {
          const location = await getLocationCached(ip);
          const regionKey = location !== "未知" ? location : config.prefix;
          return {
            remark: `${location}-${port}-${ip}`,
            regionKey: regionKey,
          };
        }

        const chineseRegion = getChineseLocationName(region) || region;
        const chineseCity = getChineseLocationName(city) || city;
        const chineseCountry = getChineseLocationName(country) || country;

        // 构建别名部分，遵循规则：
        // - 如果存在城市： 城市 - （可选速度） - 端口 - 国家 - IP
        // - 否则（只有国家/地区）： 国家/地区 - （可选速度） - 端口 - IP
        const parts = [];

        const hasCity = !!(chineseCity && chineseCity.trim());
        const hasCountry = !!(chineseCountry && chineseCountry.trim());

        if (hasCity) {
          parts.push(chineseCity.trim());
        } else if (chineseRegion && chineseRegion.trim()) {
          parts.push(chineseRegion.trim());
        } else if (hasCountry) {
          parts.push(chineseCountry.trim());
        }

        // 下载速度（如果有）
        if (speed && speed.trim()) {
          const speedMatch = speed.match(/(\d+(\.\d+)?)/);
          if (speedMatch) parts.push(`${speedMatch[1]}MB/s`);
        }

        // 端口
        parts.push(port.toString());

        // 若有城市，则在端口后加入国家（若存在）
        // 但如果国家是中国或新加坡且已有城市/地区名，则不显示国家名
        if (hasCity && hasCountry) {
          const shouldSkipCountry =
            (chineseCountry === "中国" || chineseCountry === "新加坡") &&
            (hasCity || (chineseRegion && chineseRegion.trim()));
          if (!shouldSkipCountry) {
            parts.push(chineseCountry.trim());
          }
        }

        // 确定地区key用于分组（优先城市、地区、国家）
        let regionKey = "";
        if (chineseCity && chineseCity.trim()) regionKey = chineseCity.trim();
        else if (chineseRegion && chineseRegion.trim())
          regionKey = chineseRegion.trim();
        else if (chineseCountry && chineseCountry.trim())
          regionKey = chineseCountry.trim();
        else {
          const addrType = getAddressType(ip);
          if (addrType === "ipv6") {
            regionKey = "IPv6节点";
          } else if (addrType === "domain") {
            regionKey = "域名节点";
          } else {
            const detectedLocation = await getLocationCached(ip);
            regionKey =
              detectedLocation !== "未知" ? detectedLocation : config.prefix;
          }
        }

        // 如果parts只有端口等异常情况，回退到IP检测
        if (parts.length === 0 || parts.length === 1) {
          const addrType2 = getAddressType(ip);
          parts.length = 0;
          if (addrType2 === "ipv6") {
            parts.push("IPv6节点");
            regionKey = "IPv6节点";
          } else if (addrType2 === "domain") {
            parts.push("域名节点");
            regionKey = "域名节点";
          } else {
            const detectedLocation = await getLocationCached(ip);
            parts.push(
              detectedLocation !== "未知" ? detectedLocation : config.prefix,
            );
            regionKey =
              detectedLocation !== "未知" ? detectedLocation : config.prefix;
          }
          parts.push(port.toString());
          parts.push(shortenAddressForAlias(ip));
        }

        // 最终补上IP（如果尚未加入）
        if (parts[parts.length - 1] !== shortenAddressForAlias(ip))
          parts.push(shortenAddressForAlias(ip));

        return {
          remark: parts.join("-"),
          regionKey: regionKey,
        };
      }

      // 解析粘贴文本 - 修复：使用新的别名生成逻辑
      // 解析粘贴文本 - 修复别名生成逻辑，按照需求2生成别名
      async function parsePasteText(text, config) {
        const ipPortPairs = smartSplitIPPort(text);
        const nodes = [];
        const regionGroups = {};

        for (const pair of ipPortPairs) {
          const { ip, port } = pair;

          if (!ip) continue;

          // 强制使用443端口（如果勾选了此选项）
          let finalPort = port;
          if (config.force443) {
            finalPort = 443;
          }
          // 如果没有找到端口，使用默认端口
          else if (!finalPort) {
            finalPort = config.defaultPort;
          }

          // 使用IP检测获取地区信息（IPv6和域名不使用数据库查询）
          const addrType = getAddressType(ip);
          let regionName;
          let isUnknownRegion = false;
          if (addrType === "ipv6") {
            regionName = "IPv6节点";
            isUnknownRegion = true;
          } else if (addrType === "domain") {
            regionName = "域名节点";
            isUnknownRegion = true;
          } else {
            const location = await getLocation(ip);
            if (location !== "未知") {
              regionName = location;
            } else {
              regionName = config.prefix;
              isUnknownRegion = true;
            }
          }

          // 初始化地区组
          if (!regionGroups[regionName]) {
            regionGroups[regionName] = {
              nodes: [],
              counter: 1,
            };
          }

          // 为当前节点生成序号
          const sequence = regionGroups[regionName].counter++;

          // 生成别名：地区名(序号)-端口-地址
          // 序号默认关闭(节点配置中可开启);获取不到地区的节点始终带序号
          const remark = buildNodeAlias({
            name: regionName,
            sub: "",
            sequence: sequence,
            showSequence: config.showSequence,
            alwaysSequence: isUnknownRegion,
            showSpeed: false,
            speed: "",
            port: finalPort,
            address: shortenAddressForAlias(ip),
          });

          // 保存节点信息
          regionGroups[regionName].nodes.push({
            ip: ip,
            port: finalPort,
            remark: remark,
            config: config,
          });

          // 增加计数器
          regionGroups[regionName].counter++;
        }

        // 生成所有节点
        Object.keys(regionGroups).forEach((regionName) => {
          regionGroups[regionName].nodes.forEach((node) => {
            nodes.push(
              generateLink(node.ip, node.port, node.config, node.remark),
            );
          });
        });

        return nodes;
      }

      // 新增：智能分割IP和端口 - 修复：支持多个空格分隔
      function smartSplitIPPort(text) {
        const result = [];
        const seen = new Set(); // 用于去重

        // 替换常见分隔符为统一的分隔符，处理多个空格
        let normalizedText = text.replace(/[,;\s]+/g, " ");
        normalizedText = normalizedText.replace(/\s+/g, " "); // 将多个空格替换为单个空格

        // 使用正则表达式匹配IP:端口或IP 端口
        // 匹配格式: IP:端口 或 IP 端口 或 只有IP
        // 修复：支持IP和端口之间多个空格的情况
        const ipPortPattern =
          /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\s*[:,\s]\s*(\d{1,5}))?/g;

        let match;
        while ((match = ipPortPattern.exec(text)) !== null) {
          const ip = match[1];
          const port = match[2] ? parseInt(match[2]) : null;

          // 验证IP有效性
          if (!isValidIP(ip)) continue;

          // 验证端口有效性
          if (port !== null && (port < 1 || port > 65535)) continue;

          // 去重
          const key = `${ip}:${port || "default"}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ ip, port });
          }
        }

        // 新增：匹配方括号包裹的IPv6地址（[::1]:443 或 [2606:4700:9a62::e08f:d766]:443）
        const bracketedIPv6Pattern =
          /\[([0-9a-fA-F:]+)\](?:\s*[:,\s]\s*(\d{1,5}))?/g;
        while ((match = bracketedIPv6Pattern.exec(text)) !== null) {
          const ip = match[1];
          const port = match[2] ? parseInt(match[2]) : null;
          if (port !== null && (port < 1 || port > 65535)) continue;
          if (!isValidIPv6(ip)) continue;
          const key = `${ip}:${port || "default"}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ ip, port });
          }
        }

        // 新增：匹配域名:端口格式（cdn.2158.cc:443 或 cdn.2158.cc 443）
        const domainPortPattern =
          /([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\s*[:,\s]\s*(\d{1,5})/g;
        while ((match = domainPortPattern.exec(text)) !== null) {
          const fullMatch = match[0];
          const sepMatch = fullMatch.match(/\s*[:,\s]\s*(\d{1,5})$/);
          if (!sepMatch) continue;
          const domain = fullMatch.substring(
            0,
            fullMatch.length - sepMatch[0].length,
          );
          const port = parseInt(sepMatch[1]);
          if (port < 1 || port > 65535) continue;
          if (!isValidDomain(domain)) continue;
          const key = `${domain}:${port}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push({ ip: domain, port });
          }
        }

        // 如果没有匹配到IP:端口格式，尝试其他格式
        if (result.length === 0) {
          // 分割文本成单词
          const words = normalizedText.split(/\s+/).filter((w) => w.trim());

          for (let i = 0; i < words.length; i++) {
            const word = words[i].trim();

            // 检查是否是IP地址（IPv4）
            if (isValidIP(word)) {
              const ip = word;
              let port = null;

              // 检查下一个单词是否是端口
              if (i + 1 < words.length) {
                const nextWord = words[i + 1];
                const possiblePort = parseInt(nextWord);
                if (
                  !isNaN(possiblePort) &&
                  possiblePort >= 1 &&
                  possiblePort <= 65535
                ) {
                  port = possiblePort;
                  i++; // 跳过端口单词
                }
              }

              // 去重
              const key = `${ip}:${port || "default"}`;
              if (!seen.has(key)) {
                seen.add(key);
                result.push({ ip, port });
              }
            }
            // 新增：检查是否是IPv6地址
            else if (isValidIPv6(word)) {
              const ip = word;
              let port = null;
              if (i + 1 < words.length) {
                const nextWord = words[i + 1];
                const possiblePort = parseInt(nextWord);
                if (
                  !isNaN(possiblePort) &&
                  possiblePort >= 1 &&
                  possiblePort <= 65535
                ) {
                  port = possiblePort;
                  i++;
                }
              }
              const key = `${ip}:${port || "default"}`;
              if (!seen.has(key)) {
                seen.add(key);
                result.push({ ip, port });
              }
            }
            // 新增：检查是否是域名
            else if (isValidDomain(word)) {
              const domain = word;
              let port = null;
              if (i + 1 < words.length) {
                const nextWord = words[i + 1];
                const possiblePort = parseInt(nextWord);
                if (
                  !isNaN(possiblePort) &&
                  possiblePort >= 1 &&
                  possiblePort <= 65535
                ) {
                  port = possiblePort;
                  i++;
                }
              }
              const key = `${domain}:${port || "default"}`;
              if (!seen.has(key)) {
                seen.add(key);
                result.push({ ip: domain, port });
              }
            }
            // 检查是否是IP:端口格式（已处理过，但这里作为后备）
            else if (word.includes(":")) {
              const parts = word.split(":");
              if (parts.length === 2) {
                const ip = parts[0].trim();
                const portStr = parts[1].trim();

                if (isValidIP(ip)) {
                  const port = parseInt(portStr);
                  if (!isNaN(port) && port >= 1 && port <= 65535) {
                    const key = `${ip}:${port}`;
                    if (!seen.has(key)) {
                      seen.add(key);
                      result.push({ ip, port });
                    }
                  }
                }
              }
            }
          }
        }

        return result;
      }

      function parseCSVLine(line) {
        const result = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const next = line[i + 1];

          if (char === '"' && !inQuotes) inQuotes = true;
          else if (char === '"' && inQuotes && next === '"') {
            current += '"';
            i++;
          } else if (char === '"' && inQuotes) inQuotes = false;
          else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else current += char;
        }
        result.push(current.trim());
        return result;
      }

      // 生成Vless链接，包含insecure和allowInsecure参数
      function generateLink(ip, port, config, remark) {
        // IPv6地址需要用方括号包裹
        const formattedIP = getAddressType(ip) === "ipv6" ? `[${ip}]` : ip;
        // 读取自定义Path参数，默认值来自 config.js 的 defaultVlessConfig.path
        const vlessDefaults = getVlessDefaults();
        const customPath =
          config.customPath || vlessDefaults.path || "/";
        const encodedPath = encodeURIComponent(customPath);
        const params = [
          `encryption=${vlessDefaults.encryption || "none"}`,
          `security=${vlessDefaults.security || "tls"}`,
          `sni=${encodeURIComponent(config.sni)}`,
          `fp=${config.fp}`,
          `insecure=${vlessDefaults.insecure ? 1 : 0}`,
          `allowInsecure=${vlessDefaults.allowInsecure ? 1 : 0}`,
          `type=${vlessDefaults.network || "ws"}`,
          `host=${encodeURIComponent(config.host)}`,
          `path=${encodedPath}`,
        ];
        return `vless://${config.uuid}@${formattedIP}:${port}?${params.join("&")}#${encodeURIComponent(remark)}`;
      }

      function displayVlessLinks() {
        const el = document.getElementById("vless-links");
        el.textContent = data.vlessLinks.length
          ? data.vlessLinks.join("\n\n")
          : "Vless链接将在这里显示...";
        el.classList.toggle("empty", data.vlessLinks.length === 0);
        document.getElementById("resultCount").textContent =
          `${data.vlessLinks.length}节点`;
        document.getElementById("localNodeCount").textContent =
          `${data.vlessLinks.length}节点`;
      }

      function displayRemoteVlessLinks() {
        const el = document.getElementById("remote-vless-links");
        const countEl = document.getElementById("remoteVlessCount");
        if (!el) return;
        el.textContent = data.remoteNodes.length
          ? data.remoteNodes.join("\n\n")
          : "点击“下载远程订阅”后，远程Vless链接将在这里显示...";
        el.classList.toggle("empty", data.remoteNodes.length === 0);
        if (countEl) {
          countEl.textContent = `${data.remoteNodes.length}节点`;
        }
      }

      function generateRemoteVless() {
        showLoading(true, "generateRemoteVlessBtn");
        try {
          const remoteLinks = (data.remoteNodes || []).filter((line) =>
            String(line).trim().startsWith("vless://"),
          );
          if (remoteLinks.length === 0) {
            showNotification(
              "生成节点失败",
              "请先点击“下载远程订阅”，当前没有可替换的远程Vless链接",
              "error",
            );
            return;
          }

          const config = getConfig();
          const generated = remoteLinks.map((link) =>
            updateDirectVlessConfig(link, config),
          );

          data.remoteNodes = generated;
          data.stats.remote = generated.length;
          data.cache.remoteNodes = [...generated];
          displayRemoteVlessLinks();
          updateStats();

          showNotification(
            "节点生成成功",
            `已按当前配置替换生成 ${generated.length} 个远程Vless节点`,
            "success",
          );
          addLog(
            "替换远程Vless",
            `成功替换生成 ${generated.length} 个远程Vless节点`,
            "success",
          );
        } catch (e) {
          showNotification(
            "节点生成失败",
            "替换远程Vless时发生错误: " + e.message,
            "error",
          );
          addLog("替换远程Vless", "生成失败: " + e.message, "error");
        } finally {
          showLoading(false, "generateRemoteVlessBtn");
        }
      }

      // 新增：HTML转义辅助函数（防止XSS）
      function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
      }

      // 新增：节点预览功能
      function showNodePreview() {
        if (data.vlessLinks.length === 0) {
          showNotification(
            "预览失败",
            "请先生成节点，当前没有可预览的数据",
            "warning",
          );
          return;
        }

        // 移除已存在的预览弹窗
        const existingModal = document.getElementById("previewModal");
        if (existingModal) {
          existingModal.remove();
        }

        // 解析所有vless链接
        const previewData = [];
        data.vlessLinks.forEach((link, index) => {
          const parsed = parseVlessUrl(link);
          if (parsed) {
            const addrType = getAddressType(parsed.server);
            previewData.push({
              seq: index + 1,
              alias: parsed.name || `节点${index + 1}`,
              address: parsed.server,
              port: parsed.port,
              type: addrType || "未知",
            });
          }
        });

        // 构建表格行
        const typeLabels = {
          ipv4: "IPv4",
          ipv6: "IPv6",
          domain: "域名",
          未知: "未知",
        };
        const typeColors = {
          ipv4: "#3b82f6",
          ipv6: "#8b5cf6",
          domain: "#10b981",
          未知: "#6b7280",
        };

        let tableRows = "";
        previewData.forEach((row) => {
          const label = typeLabels[row.type] || row.type;
          const color = typeColors[row.type] || "#6b7280";
          tableRows += `
                    <tr>
                        <td style="text-align:center;color:#6b7280;">${row.seq}</td>
                        <td title="${escapeHtml(row.alias)}">${escapeHtml(row.alias.length > 30 ? row.alias.substring(0, 30) + "..." : row.alias)}</td>
                        <td>
                            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${color}20;color:${color};margin-right:6px;">${label}</span>
                            <code style="font-size:12px;">${escapeHtml(row.address)}</code>
                        </td>
                        <td style="text-align:center;font-weight:600;color:#4b5563;">${row.port}</td>
                    </tr>`;
        });

        // 创建弹窗
        const overlay = document.createElement("div");
        overlay.id = "previewModal";
        overlay.className = "custom-dialog-overlay";
        overlay.style.zIndex = "2001";

        overlay.innerHTML = `
                <div class="custom-dialog" style="max-width:900px;min-width:600px;max-height:80vh;display:flex;flex-direction:column;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-shrink:0;">
                        <div>
                            <span style="font-size:22px;font-weight:700;color:#2d3748;">👁️ 节点预览</span>
                            <span style="margin-left:12px;font-size:14px;color:#6b7280;">共 ${previewData.length} 个节点</span>
                        </div>
                        <button id="closePreviewBtn" class="custom-dialog-btn custom-dialog-btn-cancel" style="padding:8px 16px;">关闭</button>
                    </div>
                    <div style="overflow-y:auto;flex:1;">
                        <table style="width:100%;border-collapse:collapse;font-size:14px;">
                            <thead>
                                <tr style="background:#f8fafc;position:sticky;top:0;">
                                    <th style="padding:10px 8px;text-align:center;border-bottom:2px solid #e2e8f0;color:#64748b;width:50px;">序号</th>
                                    <th style="padding:10px 8px;text-align:left;border-bottom:2px solid #e2e8f0;color:#64748b;">别名</th>
                                    <th style="padding:10px 8px;text-align:left;border-bottom:2px solid #e2e8f0;color:#64748b;">地址</th>
                                    <th style="padding:10px 8px;text-align:center;border-bottom:2px solid #e2e8f0;color:#64748b;width:80px;">端口</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>`;

        document.body.appendChild(overlay);

        // 关闭事件
        const closeModal = () => overlay.remove();
        document
          .getElementById("closePreviewBtn")
          .addEventListener("click", closeModal);
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) closeModal();
        });

        // ESC键关闭
        const escHandler = (e) => {
          if (e.key === "Escape") {
            closeModal();
            document.removeEventListener("keydown", escHandler);
          }
        };
        document.addEventListener("keydown", escHandler);
      }

