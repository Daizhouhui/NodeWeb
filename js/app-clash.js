      // 新增：YAML字符串转义函数 - 确保特殊字符不破坏YAML结构
      function yamlQuote(str) {
        if (!str) return '""';
        // 如果包含特殊字符、冒号、井号等需要用引号包围
        if (/[:"\#\{\}\[\]&\*'|>@`\n\r\t]/.test(str)) {
          // 转义双引号和反斜杠
          return '"' + str.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
        }
        return '"' + str + '"';
      }

      // 生成Clash YAML配置
      function generateClashYAML(nodes) {
        const proxies = [];
        const proxyNames = [];

        nodes.forEach((node, index) => {
          try {
            const parsed = parseVlessUrl(node);
            if (parsed) {
              const proxyName = parsed.name || `节点${index + 1}`;
              proxyNames.push(proxyName);

              const proxy = {
                name: proxyName,
                type: "vless",
                server: parsed.server,
                port: parsed.port,
                uuid: parsed.uuid,
                network: parsed.network || "tcp",
                tls: parsed.tls,
                "skip-cert-verify": parsed.skipCertVerify || false,
                udp: true,
              };

              // 添加SNI
              if (parsed.sni) {
                proxy.sni = parsed.sni;
              }

              // 添加ALPN
              if (parsed.alpn) {
                proxy.alpn = parsed.alpn.split(",");
              }

              // 添加flow (XTLS)
              if (parsed.flow) {
                proxy.flow = parsed.flow;
              }

              // 添加ws配置
              if (parsed.network === "ws") {
                proxy["ws-opts"] = {
                  path: parsed.wsPath || "/",
                  headers: parsed.wsHeaders || {},
                };
              }

              proxies.push(proxy);
            }
          } catch (e) {
            console.warn(`跳过无效节点: ${node}`, e);
          }
        });

        const clashConfig = getClashConfig();
        const config = {
          "proxy-groups": (
            Array.isArray(clashConfig.proxyGroups) ? clashConfig.proxyGroups : []
          ).map((group) => Object.assign({}, group, { proxies: proxyNames })),
          rules: Array.isArray(clashConfig.rules) ? clashConfig.rules : [],
        };

        // 使用js-yaml库或手动构建YAML格式
        // 由于浏览器环境，我们手动构建YAML格式
        let yamlContent = "";

        // 添加代理配置
        yamlContent += "proxies:\n";
        proxies.forEach((proxy) => {
          yamlContent += "  - name: " + yamlQuote(proxy.name) + "\n";
          yamlContent += "    type: " + proxy.type + "\n";
          yamlContent += "    server: " + proxy.server + "\n";
          yamlContent += "    port: " + proxy.port + "\n";
          yamlContent += "    uuid: " + proxy.uuid + "\n";
          yamlContent += "    network: " + proxy.network + "\n";
          yamlContent += "    tls: " + proxy.tls + "\n";
          yamlContent +=
            "    skip-cert-verify: " + proxy["skip-cert-verify"] + "\n";
          yamlContent += "    udp: " + proxy.udp + "\n";

          // 添加SNI
          if (proxy.sni) {
            yamlContent += "    sni: " + yamlQuote(proxy.sni) + "\n";
          }

          // 添加ALPN
          if (proxy.alpn && Array.isArray(proxy.alpn)) {
            yamlContent += "    alpn:\n";
            proxy.alpn.forEach((alpn) => {
              yamlContent += "      - " + yamlQuote(alpn.trim()) + "\n";
            });
          }

          // 添加flow (XTLS)
          if (proxy.flow) {
            yamlContent += '    flow: "' + proxy.flow + '"\n';
          }

          if (proxy["ws-opts"]) {
            yamlContent += "    ws-opts:\n";
            yamlContent +=
              "      path: " + yamlQuote(proxy["ws-opts"].path) + "\n";
            if (
              proxy["ws-opts"].headers &&
              Object.keys(proxy["ws-opts"].headers).length > 0
            ) {
              yamlContent += "      headers:\n";
              Object.entries(proxy["ws-opts"].headers).forEach(
                ([key, value]) => {
                  yamlContent +=
                    "        " + key + ": " + yamlQuote(value) + "\n";
                },
              );
            }
          }
          yamlContent += "\n";
        });

        // 添加代理组
        yamlContent += "proxy-groups:\n";
        config["proxy-groups"].forEach((group) => {
          yamlContent += "  - name: " + yamlQuote(group.name) + "\n";
          yamlContent += "    type: " + group.type + "\n";
          yamlContent += "    proxies:\n";
          group.proxies.forEach((proxy) => {
            yamlContent += "      - " + yamlQuote(proxy) + "\n";
          });
          if (group.url) {
            yamlContent += "    url: " + yamlQuote(group.url) + "\n";
          }
          if (group.interval) {
            yamlContent += "    interval: " + group.interval + "\n";
          }
          yamlContent += "\n";
        });

        // 添加规则
        yamlContent += "rules:\n";
        config.rules.forEach((rule) => {
          yamlContent += "  - " + rule + "\n";
        });

        // 添加其他配置（均来自 config.js 的 clash 配置）
        const ports = clashConfig.ports || {};
        yamlContent += `\nport: ${ports.port || 7890}\n`;
        yamlContent += `socks-port: ${ports["socks-port"] || 7891}\n`;
        yamlContent += `redir-port: ${ports["redir-port"] || 7892}\n`;
        yamlContent += `mixed-port: ${ports["mixed-port"] || 7893}\n`;
        yamlContent += `tproxy-port: ${ports["tproxy-port"] || 7895}\n`;
        yamlContent += `allow-lan: ${typeof clashConfig.allowLan === "boolean" ? clashConfig.allowLan : true}\n`;
        yamlContent += `mode: ${clashConfig.mode || "rule"}\n`;
        yamlContent += `log-level: ${clashConfig.logLevel || "info"}\n`;
        yamlContent += `ipv6: ${typeof clashConfig.ipv6 === "boolean" ? clashConfig.ipv6 : false}\n`;
        yamlContent += `external-controller: ${clashConfig.externalController || "127.0.0.1:9090"}\n`;

        return yamlContent;
      }

      // 解析Vless URL的辅助函数
      function parseVlessUrl(url) {
        try {
          // 检查是否是vless协议
          if (!url.startsWith("vless://")) {
            return null;
          }

          // 移除协议部分
          let urlWithoutProtocol = url.substring(8); // 移除 'vless://'

          // 处理包含#的URL，需要小心处理fragment
          let urlWithoutFragment = urlWithoutProtocol;
          let remarks = "";

          // 检查是否有fragment（#后面的内容）
          const hashIndex = urlWithoutProtocol.indexOf("#");
          if (hashIndex !== -1) {
            urlWithoutFragment = urlWithoutProtocol.substring(0, hashIndex);
            remarks = urlWithoutProtocol.substring(hashIndex + 1);
            // URL解码remarks
            try {
              remarks = decodeURIComponent(remarks);
            } catch (e) {
              // 如果解码失败，保持原样
            }
          }

          // 分离路径和查询参数
          const queryIndex = urlWithoutFragment.indexOf("?");
          let pathPart = urlWithoutFragment;
          let queryPart = "";

          if (queryIndex !== -1) {
            pathPart = urlWithoutFragment.substring(0, queryIndex);
            queryPart = urlWithoutFragment.substring(queryIndex + 1);
          }

          // 解析路径部分: uuid@server:port
          const pathParts = pathPart.split("@");
          if (pathParts.length !== 2) {
            return null;
          }

          const uuid = pathParts[0];
          let server, port;

          // 处理方括号包裹的IPv6: [2606:4700:9a62::e08f:d766]:443
          if (pathParts[1].startsWith("[")) {
            const closeBracket = pathParts[1].lastIndexOf("]");
            if (closeBracket === -1) return null;
            server = pathParts[1].substring(1, closeBracket);
            const afterBracket = pathParts[1].substring(closeBracket + 1);
            if (afterBracket.startsWith(":")) {
              port = parseInt(afterBracket.substring(1));
            } else {
              return null;
            }
          } else {
            // 标准 IPv4 或 域名:端口
            const serverPort = pathParts[1].split(":");
            if (serverPort.length !== 2) {
              return null;
            }
            server = serverPort[0];
            port = parseInt(serverPort[1]);
          }

          if (!uuid || !server || isNaN(port)) {
            return null;
          }

          // 解析查询参数
          const params = {};
          if (queryPart) {
            const paramPairs = queryPart.split("&");
            paramPairs.forEach((pair) => {
              const [key, value] = pair.split("=");
              params[key] = value || "";
            });
          }

          return {
            uuid: uuid,
            server: server,
            port: port,
            name: params.name || remarks || `节点-${server}:${port}`,
            network: params.type || "tcp",
            tls: params.security === "tls",
            wsPath: params.path ? decodeURIComponent(params.path) : "/",
            wsHeaders: params.host ? { Host: params.host } : {},
            skipCertVerify:
              params.allowInsecure === "1" || params.fp === "chrome",
            encryption: params.encryption || "none",
            sni: params.sni,
            alpn: params.alpn,
            flow: params.flow,
          };
        } catch (e) {
          console.warn("解析Vless URL失败:", url, e);
          return null;
        }
      }

