      // 新增：智能检测CSV列功能 - 修复：准确检测速度列和端口列
      // 新增：智能检测CSV列功能 - 完整修复版
      function autoDetectCSVColumns(
        selectedFile = null,
        onComplete = () => {},
      ) {
        const fileInput = document.getElementById("fileInput");
        const file =
          selectedFile ||
          (fileInput.files && fileInput.files.length > 0
            ? fileInput.files[0]
            : null);
        if (!file) {
          showNotification("检测失败", "请先上传CSV文件", "warning");
          onComplete(false);
          return;
        }

        const reader = new FileReader();

        reader.onload = function (e) {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter((line) => line.trim());

          if (lines.length === 0) {
            showNotification("检测失败", "CSV文件为空", "error");
            onComplete(false);
            return;
          }

          // 尝试解析CSV内容
          const firstFewLines = lines.slice(0, 15); // 分析前15行以获得更多样本
          const rows = [];

          for (let line of firstFewLines) {
            try {
              const row = parseCSVLine(line);
              if (row.length > 0) {
                rows.push(row);
              }
            } catch (e) {
              console.warn("解析CSV行失败:", e);
            }
          }

          if (rows.length === 0) {
            showNotification("检测失败", "无法解析CSV文件格式", "error");
            onComplete(false);
            return;
          }

          // 检测是否有标题行
          let hasHeader = false;
          const firstRow = rows[0];
          const secondRow = rows.length > 1 ? rows[1] : [];

          // 检查第一行是否包含常见的标题关键词
          const headerKeywords = [
            "host",
            "ip",
            "address",
            "服务器",
            "ip地址",
            "IP 地址",
            "port",
            "端口",
            "city",
            "城市",
            "地区",
            "location",
            "country",
            "国家",
            "country_code",
            "nation",
            "country_name",
            "region",
            "区域",
            "州",
            "省",
            "area",
            "code",
            "地区码",
            "speed",
            "速度",
            "下载速度",
            "带宽",
            "download",
            "mb/s",
            "mb",
            "mbit",
            "delay",
            "延迟",
            "平均延迟",
            "ping",
            "time",
            "ms", // 延迟相关关键词
          ];

          let headerMatchCount = 0;
          let firstRowIsLikelyData = false;

          // 检查第一行是否是数据（包含IP或数字）
          for (let cell of firstRow) {
            const cellStr = cell.toString().trim();
            if (
              isValidIP(cellStr) ||
              isValidIPv6(cellStr) ||
              isValidDomain(cellStr) ||
              /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cellStr)
            ) {
              firstRowIsLikelyData = true;
              break;
            }
            if (
              /^\d{1,5}$/.test(cellStr) &&
              parseInt(cellStr) >= 1 &&
              parseInt(cellStr) <= 65535
            ) {
              firstRowIsLikelyData = true;
              break;
            }
          }

          // 检查第一行是否包含标题关键词
          for (let cell of firstRow) {
            const lowerCell = cell.toString().toLowerCase().trim();
            for (let keyword of headerKeywords) {
              if (lowerCell.includes(keyword.toLowerCase())) {
                headerMatchCount++;
                break;
              }
            }
          }

          // 判断是否有标题行
          hasHeader = headerMatchCount >= 2 && !firstRowIsLikelyData;

          // 确定数据起始行
          const dataStartIndex = hasHeader ? 1 : 0;
          const dataRows = rows.slice(dataStartIndex).slice(0, 10); // 只分析前10行数据

          if (dataRows.length === 0) {
            showNotification("检测失败", "CSV文件中没有数据行", "error");
            return;
          }

          // 检测各列
          const columnCount = Math.max(...dataRows.map((row) => row.length));
          const columnStats = new Array(columnCount).fill().map(() => ({
            ipCount: 0,
            ipv6Count: 0,
            domainCount: 0,
            portCount: 0,
            speedCount: 0,
            delayCount: 0,
            textCount: 0,
            numericCount: 0,
            total: 0,
            values: [], // 存储实际值用于分析
          }));

          // 收集列统计信息
          for (let row of dataRows) {
            for (let i = 0; i < row.length; i++) {
              const cell = row[i].toString().trim();
              columnStats[i].total++;
              columnStats[i].values.push(cell);

              if (isValidIP(cell)) {
                columnStats[i].ipCount++;
              }
              // 新增：检测IPv6
              else if (isValidIPv6(cell)) {
                columnStats[i].ipv6Count++;
              }
              // 新增：检测域名
              else if (isValidDomain(cell)) {
                columnStats[i].domainCount++;
              }
              // 检测端口（1-65535的整数）
              else if (/^\d{1,5}$/.test(cell)) {
                const num = parseInt(cell);
                if (num >= 1 && num <= 65535) {
                  columnStats[i].portCount++;
                }
              }
              // 检测速度（包含数字和速度单位）
              else if (isSpeedValue(cell)) {
                columnStats[i].speedCount++;
              }
              // 检测延迟（包含数字和时间单位）
              else if (isDelayValue(cell)) {
                columnStats[i].delayCount++;
              }
              // 检测数字（包含小数）
              else if (/^-?\d+(\.\d+)?$/.test(cell)) {
                columnStats[i].numericCount++;
              }
              // 文本内容
              else if (cell.length > 0) {
                columnStats[i].textCount++;
              }
            }
          }

          // 检测IP列（包含IPv4、IPv6和域名）
          let ipColumn = 0;
          let maxIpScore = 0;
          for (let i = 0; i < columnStats.length; i++) {
            const addressCount =
              columnStats[i].ipCount +
              columnStats[i].ipv6Count +
              columnStats[i].domainCount;
            const ipScore = addressCount / Math.max(1, columnStats[i].total);
            if (ipScore > maxIpScore) {
              maxIpScore = ipScore;
              ipColumn = i;
            }
          }

          // 检测端口列 - 改进算法
          let portColumn = -1;
          let maxPortScore = 0;

          // 方法1：基于标题检测
          if (hasHeader) {
            for (let i = 0; i < firstRow.length; i++) {
              const header = firstRow[i].toString().toLowerCase();
              if (header.includes("port") || header.includes("端口")) {
                portColumn = i;
                break;
              }
            }
          }

          // 方法2：基于数据模式检测
          if (portColumn === -1) {
            for (let i = 0; i < columnStats.length; i++) {
              if (i === ipColumn) continue;

              // 计算端口得分
              const portScore =
                columnStats[i].portCount / Math.max(1, columnStats[i].total);

              // 检查是否是常见端口
              const commonPorts = [80, 443, 8080, 8443, 22, 21, 25, 53];
              let commonPortMatches = 0;
              for (const value of columnStats[i].values) {
                if (commonPorts.includes(parseInt(value))) {
                  commonPortMatches++;
                }
              }
              const commonPortScore =
                commonPortMatches / Math.max(1, columnStats[i].total);

              // 综合得分
              const totalScore = portScore * 0.7 + commonPortScore * 0.3;

              if (totalScore > maxPortScore && totalScore > 0.4) {
                // 阈值提高到40%
                maxPortScore = totalScore;
                portColumn = i;
              }
            }
          }

          const getHeader = (index) =>
            firstRow[index]
              .toString()
              .replace(/^\uFEFF/, "")
              .toLowerCase()
              .trim();
          const findHeaderColumn = (matches, excluded = []) => {
            if (!hasHeader) return -1;
            return firstRow.findIndex(
              (_, index) =>
                !excluded.includes(index) && matches(getHeader(index)),
            );
          };

          // 优先依据标题识别语义列，避免城市/地区等文本列互相误判。
          let speedColumn = findHeaderColumn(
            (header) =>
              /speed|速度|速率|网速|测速|download|bandwidth|带宽|throughput|mb\/s|mbps|mbit|gb\/s|gbps|kb\/s|kbps/i.test(
                header,
              ),
            [ipColumn, portColumn],
          );
          const speedColumnDetectedByHeader = speedColumn !== -1;
          let maxSpeedScore = 0;

          // 未通过标题识别时，兼容速度值包含单位的CSV。
          if (speedColumn === -1 && columnStats.length > 6) {
            const gColumn = 6;
            const gColumnValues = columnStats[gColumn].values;
            let gSpeedScore = 0;

            for (const value of gColumnValues) {
              if (isSpeedValue(value)) {
                gSpeedScore++;
              }
            }

            if (gSpeedScore / Math.max(1, gColumnValues.length) > 0.5) {
              speedColumn = gColumn;
              maxSpeedScore = gSpeedScore / gColumnValues.length;
            }
          }

          // 如果G列不是速度列，继续正常检测
          if (speedColumn === -1) {
            for (let i = 0; i < columnStats.length; i++) {
              if (i === ipColumn || i === portColumn) continue;

              // 基于数据检测
              const speedScore =
                columnStats[i].speedCount / Math.max(1, columnStats[i].total);
              if (speedScore > maxSpeedScore && speedScore > 0.3) {
                maxSpeedScore = speedScore;
                speedColumn = i;
              }
            }
          }

          let delayColumn = findHeaderColumn(
            (header) =>
              /delay|延迟|ping|latency|响应时间|耗时/.test(header),
            [ipColumn, portColumn, speedColumn],
          );
          let maxDelayScore = 0;
          if (delayColumn === -1) {
            for (let i = 0; i < columnStats.length; i++) {
              if (
                i === ipColumn ||
                i === portColumn ||
                i === speedColumn
              ) {
                continue;
              }

              const delayScore =
                columnStats[i].delayCount / Math.max(1, columnStats[i].total);
              if (delayScore > maxDelayScore && delayScore > 0.3) {
                maxDelayScore = delayScore;
                delayColumn = i;
              }
            }
          }

          // 检测国家列
          const countryColumn = findHeaderColumn(
            (header) =>
              /country|国家|nation|国别|国家代码|国家名称/.test(header),
            [ipColumn, portColumn, speedColumn, delayColumn],
          );

          // 检测地区码列
          const regionColumn = findHeaderColumn(
            (header) =>
              /region|区域|地区码|地区代码|地区编码|区域码|行政区划|机场|州|省|area|region.?code|airport.?code/.test(
                header,
              ) ||
              (header.includes("code") &&
                !/country|国家|nation/.test(header)),
            [
              ipColumn,
              portColumn,
              speedColumn,
              delayColumn,
              countryColumn,
            ],
          );

          // 地区码优先从地区标题识别，避免被当作城市；其余文本列可作为城市候选。
          let cityColumn = findHeaderColumn(
            (header) =>
              /city|城市|location|地点|城市名称/.test(header) ||
              header === "地区",
            [
              ipColumn,
              portColumn,
              speedColumn,
              delayColumn,
              countryColumn,
              regionColumn,
            ],
          );
          if (cityColumn === -1) {
            for (let i = 0; i < columnStats.length; i++) {
              if (
                i === ipColumn ||
                i === portColumn ||
                i === speedColumn ||
                i === delayColumn ||
                i === countryColumn ||
                i === regionColumn
              ) {
                continue;
              }
              if (
                columnStats[i].textCount /
                  Math.max(1, columnStats[i].total) >
                0.7
              ) {
                cityColumn = i;
                break;
              }
            }
          }

          // 保存检测结果
          data.csvColumnDetection = {
            ipColumn: ipColumn,
            portColumn: portColumn,
            cityColumn: cityColumn,
            countryColumn: countryColumn,
            regionColumn: regionColumn,
            speedColumn: speedColumn,
            speedColumnDetectedByHeader: speedColumnDetectedByHeader,
            delayColumn: delayColumn,
            hasHeader: hasHeader,
            detected: true,
            columnStats: columnStats,
          };

          // 更新UI
          updateColumnDetectionUI();

          // 应用检测结果到表单
          applyDetectedColumns();

          // 根据检测质量设置状态类
          const resultDiv = document.getElementById("columnDetectionResult");
          let detectionQuality = "success";

          // 判断检测质量
          if (portColumn === -1 || speedColumn === -1) {
            detectionQuality = "warning";
          }

          // 移除所有状态类
          resultDiv.classList.remove("success", "warning");
          // 添加当前状态类
          resultDiv.classList.add(detectionQuality);

          const summary = `检测到${columnCount}列，${hasHeader ? "有标题行" : "无标题行"}，${createColumnDetectionSummary(data.csvColumnDetection)}`;
          showNotification("检测完成", summary, "success");
          addLog("CSV列检测", summary, "success");
          onComplete(true);
        };

        reader.onerror = function () {
          showNotification("检测失败", "无法读取文件内容", "error");
          addLog("CSV列检测", "文件读取失败", "error");
          onComplete(false);
        };

        reader.readAsText(file);
      }

      // 新增：判断是否为速度值
      // 新增：判断是否为速度值
      function isSpeedValue(value) {
        if (!value || typeof value !== "string") return false;

        const normalized = value.toLowerCase().trim();

        // 匹配速度模式
        const speedPatterns = [
          /^(\d+(\.\d+)?)\s*(mb\/s|mbps|mbit\/s|mbit|mb)$/i,
          /^(\d+(\.\d+)?)\s*(gb\/s|gbps|gbit\/s|gbit|gb)$/i,
          /^(\d+(\.\d+)?)\s*(kb\/s|kbps|kbit\/s|kbit|kb)$/i,
          /^(\d+(\.\d+)?)\s*(m\/s)$/i,
          /^(\d+(\.\d+)?)\s*速度$/i,
          /^下载速度\s*[:：]?\s*(\d+(\.\d+)?)/i,
          /^带宽\s*[:：]?\s*(\d+(\.\d+)?)/i,
        ];

        for (const pattern of speedPatterns) {
          if (pattern.test(normalized)) {
            return true;
          }
        }

        // 检查是否包含速度单位
        const speedUnits = [
          "mb/s",
          "mbps",
          "mbit/s",
          "gb/s",
          "gbps",
          "gbit/s",
          "kb/s",
          "kbps",
          "m/s",
          "速度",
          "带宽",
        ];
        for (const unit of speedUnits) {
          if (normalized.includes(unit)) {
            return true;
          }
        }

        return false;
      }

      // 新增：判断是否为延迟值
      function isDelayValue(value) {
        if (!value || typeof value !== "string") return false;

        const normalized = value.toLowerCase().trim();

        // 匹配延迟模式
        const delayPatterns = [
          /^(\d+(\.\d+)?)\s*(ms|毫秒)$/i,
          /^(\d+(\.\d+)?)\s*(s|秒)$/i,
          /^延迟\s*[:：]?\s*(\d+(\.\d+)?)/i,
          /^ping\s*[:：]?\s*(\d+(\.\d+)?)/i,
          /^(\d+(\.\d+)?)\s*ms$/i,
        ];

        for (const pattern of delayPatterns) {
          if (pattern.test(normalized)) {
            return true;
          }
        }

        // 检查是否包含延迟单位
        const delayUnits = ["ms", "毫秒", "延迟", "ping", "latency"];
        for (const unit of delayUnits) {
          if (normalized.includes(unit)) {
            return true;
          }
        }

        return false;
      }

      function formatDetectedColumn(index) {
        if (index === -1) return "未检测到";
        let columnName = "";
        let columnNumber = index + 1;
        while (columnNumber > 0) {
          columnNumber -= 1;
          columnName = String.fromCharCode(65 + (columnNumber % 26)) + columnName;
          columnNumber = Math.floor(columnNumber / 26);
        }
        return `${index + 1}(${columnName})`;
      }

      function createColumnDetectionSummary(detection) {
        return [
          `IP列: ${formatDetectedColumn(detection.ipColumn)}`,
          `端口列: ${formatDetectedColumn(detection.portColumn)}`,
          `城市列: ${formatDetectedColumn(detection.cityColumn)}`,
          `国家列: ${formatDetectedColumn(detection.countryColumn)}`,
          `地区码列: ${formatDetectedColumn(detection.regionColumn)}`,
          `速度列: ${formatDetectedColumn(detection.speedColumn)}`,
        ].join(" | ");
      }

      // 更新列检测结果显示 - 优化样式
      // 更新列检测结果显示 - 优化样式和逻辑
      // 更新列检测结果显示 - 优化样式和逻辑
      function updateColumnDetectionUI() {
        const detection = data.csvColumnDetection;
        const resultDiv = document.getElementById("columnDetectionResult");
        const summarySpan = document.getElementById("detectionSummary");
        const detailsDiv = document.getElementById("detectionDetails");

        if (detection.detected) {
          resultDiv.style.display = "block";

          summarySpan.textContent = createColumnDetectionSummary(detection);

          // 构建详细说明 - 只在有需要说明的内容时才显示
          let detailsContent = "";
          let hasImportantNotes = false;

          if (detection.portColumn === -1) {
            detailsContent += "• 未检测到端口列，将使用默认端口443<br>";
            hasImportantNotes = true;
          }

          if (detection.cityColumn === -1) {
            detailsContent += "• 未检测到城市列，必要时可手动指定<br>";
            hasImportantNotes = true;
          }

          if (detection.countryColumn === -1) {
            detailsContent += "• 未检测到国家列，必要时可手动指定<br>";
            hasImportantNotes = true;
          }

          if (detection.regionColumn === -1) {
            detailsContent += "• 未检测到地区码列，必要时可手动指定<br>";
            hasImportantNotes = true;
          }

          if (detection.speedColumn === -1) {
            detailsContent += "• 未检测到速度列，别名中将不包含速度信息<br>";
            hasImportantNotes = true;
          }

          if (detection.speedColumn !== -1) {
            const speedColStats = detection.columnStats[detection.speedColumn];
            const confidence = Math.round(
              (speedColStats.speedCount / Math.max(1, speedColStats.total)) *
                100,
            );
            if (
              confidence < 70 &&
              !detection.speedColumnDetectedByHeader
            ) {
              detailsContent += `• 速度列检测置信度较低(${confidence}%)，可能需要手动调整<br>`;
              hasImportantNotes = true;
            }
          }

          if (detection.portColumn !== -1) {
            const portColStats = detection.columnStats[detection.portColumn];
            const confidence = Math.round(
              (portColStats.portCount / Math.max(1, portColStats.total)) * 100,
            );
            if (confidence < 70) {
              detailsContent += `• 端口列检测置信度较低(${confidence}%)，可能需要手动调整<br>`;
              hasImportantNotes = true;
            }
          }

          // 如果有重要说明才显示，否则不显示说明部分
          if (hasImportantNotes) {
            detailsDiv.innerHTML =
              "<strong>检测说明：</strong><br>" + detailsContent;
            detailsDiv.style.display = "block";
          } else {
            detailsDiv.style.display = "none";
          }
        }
      }
      // 应用检测结果到表单
      function applyDetectedColumns() {
        const detection = data.csvColumnDetection;
        if (!detection.detected) return;

        const toDisplayedColumn = (index) => (index < 0 ? -1 : index + 1);
        document.getElementById("ipColumn").value = toDisplayedColumn(
          detection.ipColumn,
        );
        document.getElementById("portColumn").value = toDisplayedColumn(
          detection.portColumn,
        );
        document.getElementById("cityColumn").value = toDisplayedColumn(
          detection.cityColumn,
        );
        document.getElementById("countryColumn").value =
          toDisplayedColumn(detection.countryColumn);
        document.getElementById("regionColumn").value = toDisplayedColumn(
          detection.regionColumn,
        );
        document.getElementById("speedColumn").value = toDisplayedColumn(
          detection.speedColumn,
        );

        // 将检测结果反映在输入框上：加上 detected / not-detected 类
        const setDetectionClass = (id, colIndex) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.classList.remove("detected", "not-detected");
          if (colIndex === -1) {
            el.classList.add("not-detected");
          } else {
            el.classList.add("detected");
          }
        };

        setDetectionClass("ipColumn", detection.ipColumn);
        setDetectionClass("portColumn", detection.portColumn);
        setDetectionClass("cityColumn", detection.cityColumn);
        setDetectionClass("countryColumn", detection.countryColumn);
        setDetectionClass("regionColumn", detection.regionColumn);
        setDetectionClass("speedColumn", detection.speedColumn);
      }

