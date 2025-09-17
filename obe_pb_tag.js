(function(global) {
    // 配置加载函数
    async function loadConfig() {
        // 使用内置配置
        const defaultConfig = {
            pbs: [
                {
                    platform: "superedge",
                    postbackUrl: "https://trc-us.superedge.co.jp/api/track/postback?pixel_id=175140641258560236&tracking_id={TRACKING_ID}&cvn={EVENT}"
                },
                {
                    platform: "local_server",
                    postbackUrl: "/api/tag/postback?tag_id={TAG_ID}&tracking_id={TRACKING_ID}&cvn={EVENT}&utm_source={UTM_SOURCE}&campaign_id={CAMPAIGN_ID}&campaign_name={CAMPAIGN_NAME}&adset_id={ADSET_ID}&adset_name={ADSET_NAME}&ad_id={AD_ID}&ad_name={AD_NAME}&link_id={LINK_ID}&link_name={LINK_NAME}&offer_id={OFFER_ID}&offer_name={OFFER_NAME}&lander_id={LANDER_ID}&lander_name={LANDER_NAME}"
                },
               {
                  platform:"mediago",
                  postbackUrl:"https://sync.mediago.io/api/bidder/postback?trackingid={TRACKING_ID}&adid={AD_ID}&conversiontype={CONVERSION_TYPE}"
               }
            ],
            ops: [
                {
                    ctaSelector: "a[href*='please-relace-the-offer-link-for-obe.com']",
                    offerBaseURL: "https://www.smartlink-will-determin-the-offer-A-or-B-or-C.com/?test=ppp"
                },
                {
                    ctaSelector: "a[href*='https://www.g8mv2trk.com']",
                    offerBaseURL: ""
                }
            ],
            paramMap: [
                { lpParam: 'utm_source', offerParam: 'source_id' },
                { lpParam: 'tag_id', offerParam: 'sub1' },
                { lpParam: 'tracking_id', offerParam: 'sub2' },
                { lpParam: 'campaign_id', offerParam: 'campaign_id' },
                { lpParam: 'adset_id', offerParam: 'sub3' },
                { lpParam: 'ad_id', offerParam: 'sub4' },
                { lpParam: 'link_id', offerParam: 'sub5' },
                { lpParam: 'link_name', offerParam: 'creative_name' }
            ]
        };
        
        console.log('Using built-in default config');
        return defaultConfig;
    }

    // 从Lander url中获取参数
    function getParamFromUrl(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\\[\\]]/g, "\\\\$&");
        var regex = new RegExp("[?&]" + name + "=([^&#]*)"),
            results = regex.exec(url);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\\+/g, " "));
    }

    // 优化后的generateOfferUrl，支持[{lpParam, offerParam}]结构的参数映射
    // 如果base URL中已存在相同参数，则进行更新替换
    function generateOfferUrl(base, lpParams, paramMap) {
        var offerParams = {};
        paramMap.forEach(function(map) {
            offerParams[map.offerParam] = lpParams[map.lpParam] || '';
        });
        
        // 解析base URL，分离URL和查询参数
        var urlParts = base.split('?');
        var baseUrl = urlParts[0];
        var existingParams = {};
        
        // 解析已存在的查询参数
        if (urlParts.length > 1 && urlParts[1]) {
            urlParts[1].split('&').forEach(function(param) {
                var keyValue = param.split('=');
                if (keyValue.length === 2) {
                    existingParams[decodeURIComponent(keyValue[0])] = decodeURIComponent(keyValue[1]);
                }
            });
        }
        
        // 合并参数，新参数会覆盖已存在的参数
        var finalParams = Object.assign({}, existingParams, offerParams);
        
        // 构建最终的URL
        var queryString = Object.keys(finalParams).map(function(k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(finalParams[k]);
        }).join('&');
        
        return queryString ? baseUrl + '?' + queryString : baseUrl;
    }

    // 获取当前Lander页面URL参数并转为对象
    function getLanderParams() {
        var params = {};
        var search = window.location.search.substring(1);
        if (!search) return params;
        search.split('&').forEach(function(pair) {
            var parts = pair.split('=');
            if (parts.length === 2) {
                params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
            }
        });
        return params;
    }

    // 主初始化函数
    async function initialize() {
        const config = await loadConfig();
        console.log('Config loaded:', config);

        // 获取Lander URL参数
        let trackingId = getParamFromUrl('tracking_id') || 
                        getParamFromUrl(((config.paramMap || []).find(m => m.lpParam === 'tracking_id') || {}).offerParam || '') || 
                        "default_tid";

        // 本地缓存key
        const QUEUE_KEY = 'obe_pb_queue_v2';

        // 发送postback，失败则入队，重试次数计数
        function postback(event, retryCount) {
            console.log('postback', event, retryCount);
            retryCount = retryCount || 0;
            for (const pb of config.pbs) {
                let url = pb.postbackUrl;
                
                // 获取当前页面参数
                const lpParams = getLanderParams();
                
                // 替换所有参数占位符
                url = url.replace(/{TAG_ID}/g, lpParams.tag_id || '0')
                         .replace(/{TRACKING_ID}/g, trackingId)
                         .replace(/{EVENT}/g, event)
                         .replace(/{UTM_SOURCE}/g, lpParams.utm_source || '')
                         .replace(/{CAMPAIGN_ID}/g, lpParams.campaign_id || '')
                         .replace(/{CAMPAIGN_NAME}/g, lpParams.campaign_name || '')
                         .replace(/{ADSET_ID}/g, lpParams.adset_id || '')
                         .replace(/{ADSET_NAME}/g, lpParams.adset_name || '')
                         .replace(/{AD_ID}/g, lpParams.ad_id || '')
                         .replace(/{AD_NAME}/g, lpParams.ad_name || '')
                         .replace(/{LINK_ID}/g, lpParams.link_id || '')
                         .replace(/{LINK_NAME}/g, lpParams.link_name || '');

                         //映射 MediaGo conversiontype参数
                         if (event == 'view_content') {
                            url = url.replace(/{CONVERSION_TYPE}/g, '1');
                            url = url + '&includeintotalconversion=0'
                         } else if (event == 'click_button') {
                            url = url.replace(/{CONVERSION_TYPE}/g, '12');
                            url = url + '&includeintotalconversion=0'
                         }
                
                fetch(url, { method: "GET", mode: "no-cors", keepalive: true })
                    .catch(() => {
                        if (retryCount < 3) {
                            enqueue({ url, retryCount: retryCount + 1 });
                        }
                    });
            }
        }

        // 队列相关
        function getQueue() {
            try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
            catch { return []; }
        }
        function setQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
        function enqueue(item) {
            const q = getQueue();
            q.push(item);
            setQueue(q);
        }

        // 定时重试：仅调用 postback，失败时由 postback 内部 enqueue 处理
        setInterval(function () {
            const q = getQueue();
            if (!q.length) return;
            // 清空原队列，避免重复；失败的会在 postback 内重新入队
            setQueue([]);
            q.forEach(({ url, retryCount }) => {
                fetch(url, { method: "GET", mode: "no-cors", keepalive: true })
                .catch(() => {
                    if (retryCount < 3) {
                        enqueue({ url, retryCount: retryCount + 1 });
                    }
                });
            });
        }, 10000);

        // 进入LP页面，上报view_content事件
        console.log('view_content');
        postback("view_content");

        // offer url 替换和 click_button 上报
        // 遍历ops配置，对每个ctaSelector进行querySelectorAll
        config.ops.forEach(function(op) {
            if (!op.ctaSelector) {
                console.log('Skip invalid op config:', op);
                return;
            }
            
            document.querySelectorAll(op.ctaSelector).forEach(function(a) {
                console.log('Found element with selector:', op.ctaSelector, 'element:', a);
                if (!op.offerBaseURL) {
                    console.log('use original url offer URL:', a.href);
                    op.offerBaseURL = a.href;
                }
                if (a.href) 
                {
                    var button_id = a.id || a.getAttribute('data-id') || 'btn';
                    var lpParams = getLanderParams();
                    lpParams.button_id = button_id;
                    a.href = generateOfferUrl(op.offerBaseURL, lpParams, config.paramMap);
                    console.log('Updated a.href:', a.href);
                    a.addEventListener("click", function() {
                        // 仅上报事件；无需将 button_id 作为重试计数传入
                        postback("click_button");
                        console.log('obe-pb-manager.js click_button!', button_id);
                    });
                }
            });
        });
    }

    // 等待DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(window);