      function convertManualToBase64() {
        const input = document.getElementById("manualVlessInput").value.trim();
        if (!input) {
          showNotification(
            "转换失败",
            "请先粘贴Vless节点链接，每行一个vless://开头的链接",
            "error",
          );
          return;
        }

        const lines = input
          .split(/\r?\n/)
          .filter((l) => l.trim().startsWith("vless://"));
        if (lines.length === 0) {
          showNotification(
            "转换失败",
            "未检测到有效vless链接，请确保每行以vless://开头",
            "error",
          );
          return;
        }

        const plain = lines.join("\n");
        data.manualBase64Content = btoa(plain);

        const sec = document.getElementById("manualBase64Section");
        sec.style.display = "block";
        document.getElementById("manualBase64Output").textContent =
          data.manualBase64Content;
        document.getElementById("manualBase64Output").classList.remove("empty");

        showNotification(
          "转换成功",
          `成功转换 ${lines.length} 个节点为Base64订阅，可用于导入客户端`,
          "success",
        );
        addLog(
          "转换节点",
          `成功转换 ${lines.length} 个节点为Base64订阅`,
          "success",
        );
      }

      // 新增：手动Vless转YAML
      function convertManualToYaml() {
        const input = document.getElementById("manualVlessInput3").value.trim();
        if (!input) {
          showNotification(
            "转换失败",
            "请先粘贴Vless节点链接，每行一个vless://开头的链接",
            "error",
          );
          return;
        }

        const lines = input
          .split(/\r?\n/)
          .filter((l) => l.trim().startsWith("vless://"));
        if (lines.length === 0) {
          showNotification(
            "转换失败",
            "未检测到有效vless链接，请确保每行以vless://开头",
            "error",
          );
          return;
        }

        // 生成Clash YAML配置
        data.manualYamlContent = generateClashYAML(lines);

        const sec = document.getElementById("manualYamlSection");
        sec.style.display = "block";
        document.getElementById("manualYamlOutput").textContent =
          data.manualYamlContent;
        document.getElementById("manualYamlOutput").classList.remove("empty");

        showNotification(
          "转换成功",
          `成功转换 ${lines.length} 个节点为Clash YAML配置`,
          "success",
        );
        addLog(
          "转换节点",
          `成功转换 ${lines.length} 个节点为Clash YAML配置`,
          "success",
        );
      }

      // 新增：测试Vless URL解析
      function testVlessParse() {
        const input = document.getElementById("manualVlessInput3").value.trim();
        if (!input) {
          showNotification(
            "测试失败",
            "请先粘贴Vless节点链接进行测试",
            "error",
          );
          return;
        }

        const lines = input
          .split(/\r?\n/)
          .filter((l) => l.trim().startsWith("vless://"));
        if (lines.length === 0) {
          showNotification("测试失败", "未检测到有效vless链接", "error");
          return;
        }

        let successCount = 0;
        let failCount = 0;
        const results = [];

        lines.forEach((line, index) => {
          const parsed = parseVlessUrl(line.trim());
          if (parsed) {
            successCount++;
            results.push(
              `✅ 节点${index + 1}: ${parsed.name} (${parsed.server}:${parsed.port})`,
            );
          } else {
            failCount++;
            results.push(
              `❌ 节点${index + 1}: 解析失败 - ${line.substring(0, 50)}...`,
            );
          }
        });

        const resultText = results.join("\n");
        const sec = document.getElementById("manualYamlSection");
        sec.style.display = "block";
        document.getElementById("manualYamlOutput").textContent =
          `解析测试结果:\n成功: ${successCount} 个\n失败: ${failCount} 个\n\n${resultText}`;
        document.getElementById("manualYamlOutput").classList.remove("empty");

        if (failCount === 0) {
          showNotification(
            "测试成功",
            `所有 ${successCount} 个节点解析成功`,
            "success",
          );
        } else {
          showNotification(
            "测试完成",
            `成功: ${successCount} 个, 失败: ${failCount} 个`,
            "warning",
          );
        }
      }

      // 新增：下载手动转换的YAML
      function downloadManualYaml() {
        if (!data.manualYamlContent) {
          showNotification("下载失败", "请先转换Vless节点为YAML格式", "error");
          return;
        }

        const filename = `manual-clash-config-${new Date().toISOString().split("T")[0]}${getYamlExtension()}`;
        const blob = new Blob([data.manualYamlContent], {
          type: "application/x-yaml",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification("下载成功", `${filename} 已下载`, "success");
        addLog("下载配置", `下载了手动转换的Clash YAML配置文件`, "success");
      }

      // 新增：下载合并生成的YAML
      function downloadMergedYaml() {
        if (!data.mergedYamlContent) {
          showNotification("下载失败", "请先合并节点生成YAML配置", "error");
          return;
        }

        const filename = `merged-clash-config-${new Date().toISOString().split("T")[0]}${getYamlExtension()}`;
        const blob = new Blob([data.mergedYamlContent], {
          type: "application/x-yaml",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification("下载成功", `${filename} 已下载`, "success");
        addLog("下载配置", `下载了合并生成的Clash YAML配置文件`, "success");
      }

      // 新增：下载本地生成的YAML
      function downloadLocalYaml() {
        if (!data.localYamlContent) {
          showNotification("下载失败", "请先生成本地节点生成YAML配置", "error");
          return;
        }

        const filename = `local-clash-config-${new Date().toISOString().split("T")[0]}${getYamlExtension()}`;
        const blob = new Blob([data.localYamlContent], {
          type: "application/x-yaml",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification("下载成功", `${filename} 已下载`, "success");
        addLog("下载配置", `下载了本地生成的Clash YAML配置文件`, "success");
      }

      // 新增：上传手动转换的YAML配置到GitHub
      async function uploadManualYaml() {
        if (!data.manualYamlContent) {
          showNotification("上传失败", "请先转换Vless节点为YAML格式", "error");
          return;
        }

        showLoading(true, "uploadYamlBtn");
        try {
          const token = getGithubToken();
          if (!token) {
            showNotification(
              "上传失败",
              "请先输入GitHub Token，否则无法上传文件",
              "error",
            );
            showLoading(false, "uploadYamlBtn");
            return;
          }

          const repo = getGithubRepo();
          if (!repo) {
            showNotification(
              "上传失败",
              "请先输入GitHub仓库名称，格式为：用户名/仓库名",
              "error",
            );
            showLoading(false, "uploadYamlBtn");
            return;
          }

          // 获取YAML文件名，默认值来自 config.js 的 clash.fileName
          const yamlFileName =
            document.getElementById("yamlFileName").value.trim() ||
            getClashFileName();

          // 使用通用上传函数
          const result = await uploadToGitHub(
            yamlFileName,
            utf8ToBase64(data.manualYamlContent),
            false, // YAML文件不需要Base64编码
            `上传手动转换的Clash YAML配置 - ${new Date().toLocaleString()}`,
            false, // YAML 配置文件不是订阅文件，不请求 Worker 订阅链接
          );

          // 标记缓存需要更新
          data.cache.needsUpdate = true;

          const message = result.isNew
            ? `✅ 新建YAML配置文件 ${yamlFileName} 成功！`
            : `✅ 更新YAML配置文件 ${yamlFileName} 成功！`;

          showNotification("上传成功", message, "success");
          addLog(
            "上传YAML配置",
            `${message} (SHA: ${result.sha.substring(0, 8)}...)`,
            "success",
          );

          // 显示订阅链接
          showGithubLink("yamlConfigLink", "yamlConfigUrl", result.githubIoUrl);
        } catch (e) {
          showNotification(
            "上传失败",
            "上传过程中发生错误: " + e.message,
            "error",
          );
          addLog("上传YAML配置", "上传失败: " + e.message, "error");
        } finally {
          showLoading(false, "uploadYamlBtn");
        }
      }

      // 新增：手动Vless转IP:端口
      function convertManualToIpPort() {
        const input = document.getElementById("manualVlessInput2").value.trim();
        if (!input) {
          showNotification(
            "转换失败",
            "请先粘贴Vless节点链接，每行一个vless://开头的链接",
            "error",
          );
          return;
        }

        const lines = input
          .split(/\r?\n/)
          .filter((l) => l.trim().startsWith("vless://"));
        if (lines.length === 0) {
          showNotification(
            "转换失败",
            "未检测到有效vless链接，请确保每行以vless://开头",
            "error",
          );
          return;
        }

        const ipPortList = [];
        lines.forEach((line) => {
          // 提取IP和端口
          const match = line.match(/vless:\/\/[^@]+@([^:]+):(\d+)/);
          if (match) {
            const ip = match[1];
            const port = match[2];
            ipPortList.push(`${ip}:${port}`);
          }
        });

        if (ipPortList.length === 0) {
          showNotification(
            "转换失败",
            "无法从Vless链接中提取IP和端口",
            "error",
          );
          return;
        }

        data.manualIpPortContent = ipPortList.join("\n");

        const sec = document.getElementById("manualIpPortSection");
        sec.style.display = "block";
        document.getElementById("manualIpPortOutput").textContent =
          data.manualIpPortContent;
        document.getElementById("manualIpPortOutput").classList.remove("empty");

        showNotification(
          "转换成功",
          `成功提取 ${ipPortList.length} 个IP:端口组合`,
          "success",
        );
        addLog(
          "提取IP端口",
          `成功提取 ${ipPortList.length} 个IP:端口组合`,
          "success",
        );
      }

      // 新增：下载IP:端口TXT文件
      function downloadIpPortTxt() {
        if (!data.manualIpPortContent) {
          showNotification("下载失败", "请先提取IP:端口", "error");
          return;
        }

        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/:/g, "-");
        downloadBlob(data.manualIpPortContent, `ip_port_${timestamp}.txt`);
        showNotification("下载成功", "IP:端口文件已下载到本地", "success");
        addLog("下载文件", "IP:端口TXT文件已下载", "success");
      }

