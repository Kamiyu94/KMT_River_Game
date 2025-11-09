// 等待 HTML 內容完全載入後再執行
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DOM 元素 ---
    // 獲取所有需要互動的 HTML 元素
    const bankTaiwan = document.getElementById('bank-taiwan-chars');
    const bankChina = document.getElementById('bank-china-chars');
    const boatChars = document.getElementById('boat-chars');
    const boatElement = document.getElementById('boat');
    const moveButton = document.getElementById('move-button');
    const deathListUl = document.querySelector('#death-list ul');
    const gameLogUl = document.querySelector('#game-log ul');

    // --- 2. 遊戲核心狀態 (Game State) ---
    // 這是整個遊戲的「大腦」，儲存所有角色的位置、金錢、生死等。
    let gameState = {
        boatLocation: 'taiwan', // 船的初始位置
        characters: [],         // 角色資料
        deathList: [],        // 死亡名單
        gameLog: [],          // 遊戲日誌
        chinaArrivals: [],    // 紀錄抵達中國的順序 (為了鄭麗文規則)
        isGameOver: false,
    };

    // --- 3. 角色資料定義 ---
    // 定義所有男立委的 ID (用於王鴻薇規則)
    const MALE_IDS = ['hanguoyu', 'fuqunzhu', 'luozhiqiang', 'yeyuanzhi', 'mayingjeou', 'zhulilun'];
    // 定義王鴻薇的「壓制者」 (用於岸上規則)
    const WANG_PROTECTORS = ['luozhiqiang', 'fuqunzhu', 'hanguoyu', 'zhulilun'];

    function initializeGame() {
        // 重設遊戲狀態
        gameState = {
            boatLocation: 'taiwan',
            characters: [
                // id (唯一), name (顯示), money, canDrive, size (佔位), location, isAlive
                { id: 'hanguoyu', name: '韓國瑜', money: 200, canDrive: true, size: 1, location: 'taiwan', isAlive: true },
                { id: 'fuqunzhu', name: '傅崑萁', money: 500, canDrive: false, size: 1, location: 'taiwan', isAlive: true },
                { id: 'zhulilun', name: '朱立倫', money: 200, canDrive: true, size: 1, location: 'taiwan', isAlive: true },
                { id: 'xuxiaoqin', name: '徐巧芯', money: 200, canDrive: false, size: 1, location: 'taiwan', isAlive: true },
                { id: 'zhengliwen', name: '鄭麗文', money: 200, canDrive: true, size: 1, location: 'taiwan', isAlive: true },
                { id: 'wanghongwei', name: '王鴻薇', money: 200, canDrive: false, size: 1, location: 'taiwan', isAlive: true },
                { id: 'luozhiqiang', name: '羅智強', money: 200, canDrive: true, size: 1, location: 'taiwan', isAlive: true },
                { id: 'chenyuzhen', name: '陳玉珍', money: 200, canDrive: true, size: 2, location: 'taiwan', isAlive: true },
                { id: 'yeyuanzhi', name: '葉元之', money: 200, canDrive: false, size: 1, location: 'taiwan', isAlive: true },
                { id: 'wengxiaoling', name: '翁曉玲', money: 200, canDrive: false, size: 1, location: 'taiwan', isAlive: true },
                { id: 'mayingjeou', name: '馬英九', money: 200, canDrive: true, size: 1, location: 'taiwan', isAlive: true },
            ],
            deathList: [],
            gameLog: [],
            chinaArrivals: [],
            isGameOver: false,
        };
        logMessage('遊戲開始！請將所有立委送往中國。');
        render(); // 繪製遊戲畫面
    }

    // --- 4. 遊戲渲染 (Render) ---
    // 根據 `gameState` 更新畫面 (HTML)
    function render() {
        // 清空所有區域
        bankTaiwan.innerHTML = '';
        bankChina.innerHTML = '';
        boatChars.innerHTML = '';
        deathListUl.innerHTML = '';
        gameLogUl.innerHTML = '';

        // 更新船的位置
        boatElement.classList.toggle('at-china', gameState.boatLocation === 'china');
        boatElement.classList.toggle('at-taiwan', gameState.boatLocation === 'taiwan');

        // 根據狀態繪製每個角色
        gameState.characters.forEach(char => {
            if (!char.isAlive) return; // 死亡的角色不顯示

            const charEl = document.createElement('div');
            charEl.className = 'character';
            charEl.textContent = `${char.name} ($${char.money}萬)`;
            charEl.dataset.id = char.id; // 綁定 ID 到 data-id 屬性

            // 陳玉珍的特別樣式
            if (char.id === 'chenyuzhen') {
                charEl.classList.add('chenyuzhen');
            }

            // 放置角色到正確位置
            if (char.location === 'taiwan') {
                bankTaiwan.appendChild(charEl);
            } else if (char.location === 'china') {
                bankChina.appendChild(charEl);
            } else if (char.location === 'boat') {
                boatChars.appendChild(charEl);
            }
        });

        // 渲染死亡名單
        gameState.deathList.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            deathListUl.appendChild(li);
        });

        // 渲染遊戲日誌
        gameState.gameLog.forEach(log => {
            const li = document.createElement('li');
            li.textContent = log;
            gameLogUl.appendChild(li);
        });
        
        // 捲動到底部
        gameLogUl.scrollTop = gameLogUl.scrollHeight;
    }

    // --- 5. 事件監聽 (Event Listeners) ---

    // 點擊「開船」
    moveButton.addEventListener('click', handleMoveBoat);

    // 點擊角色 (使用事件委派)
    bankTaiwan.addEventListener('click', handleCharacterClick);
    bankChina.addEventListener('click', handleCharacterClick);
    boatChars.addEventListener('click', handleCharacterClick);

    // --- 6. 核心遊戲邏輯 (Game Logic) ---

    /**
     * 處理角色點擊事件 (上/下船)
     */
    function handleCharacterClick(event) {
        if (gameState.isGameOver) return; // 遊戲結束，禁止操作

        const clickedEl = event.target.closest('.character');
        if (!clickedEl) return; // 點到空白處

        const charId = clickedEl.dataset.id;
        const char = findCharById(charId);
        if (!char || !char.isAlive) return;

        // 從岸上 -> 船上
        if (char.location === gameState.boatLocation) {
            // 檢查船的容量
            if (getBoatSize() + char.size <= 2) {
                char.location = 'boat';
                logMessage(`${char.name} 登上了船。`);
            } else {
                logMessage(`船滿了！${char.name} (佔${char.size}位) 上不去。`);
            }
        }
        // 從船上 -> 岸上
        else if (char.location === 'boat') {
            char.location = gameState.boatLocation;
            logMessage(`${char.name} 離開了船。`);
        }

        render(); // 重新繪製畫面
    }

    /**
     * 處理「開船」按鈕事件
     */
    function handleMoveBoat() {
        if (gameState.isGameOver) return; // 遊戲結束，禁止操作

        const boatChars = getCharsOnBoat();
        const boatSize = getBoatSize();

        // --- A. 開船前檢查 (Pre-Move Checks) ---

        // 1. 船上是否有人
        if (boatSize === 0) {
            logMessage('船是空的，不能開！');
            return;
        }

        // 2. 駕駛員檢查
        const hasDriver = boatChars.some(c => c.canDrive);
        const fuOnBoat = boatChars.some(c => c.id === 'fuqunzhu');
        const yeOnBoat = boatChars.some(c => c.id === 'yeyuanzhi');

        if (fuOnBoat && boatSize === 1) { // 傅崑萁自己一人
             logMessage('傅崑萁發現自己不會開船...');
             handleSinking('fuqunzhu'); // 觸發沈船
             render();
             return;
        }
        if (fuOnBoat && hasDriver) { // 傅崑萁跟駕駛同船，但他想搶
             logMessage('傅崑萁搶著掌舵...');
             handleSinking('fuqunzhu'); // 觸發沈船
             render();
             return;
        }
        if (yeOnBoat && !hasDriver) {
             logMessage('葉元之在船上瑟瑟發抖，船開不動！');
             return;
        }
        if (!hasDriver) {
             logMessage('船上沒有人會開船！');
             return;
        }

        // 3. 船上衝突檢查
        const has = (id) => boatChars.some(c => c.id === id);
        const zhuOnBoat = has('zhulilun');

        // (韓, 傅) & !朱
        if (has('hanguoyu') && fuOnBoat && !zhuOnBoat) {
            logMessage('韓國瑜在船上把傅崑萁丟下海！');
            killCharacter('fuqunzhu', '被韓國瑜在船上丟下海');
            render(); // 傅死了，船不開
            return;
        }
        // (馬, 傅) & !朱
        if (has('mayingjeou') && fuOnBoat && !zhuOnBoat) {
            logMessage('馬英九在船上把傅崑萁推入台灣海峽！');
            killCharacter('fuqunzhu', '被馬英九在船上推入海');
            render();
            return;
        }
        // (徐, 王)
        if (has('xuxiaoqin') && has('wanghongwei')) {
            logMessage('王鴻薇在船上把徐巧芯丟下船！');
            killCharacter('xuxiaoqin', '被王鴻薇在船上丟下船');
            render();
            return;
        }
        // (王, 男立委)
        const maleOnBoat = boatChars.find(c => MALE_IDS.includes(c.id));
        if (has('wanghongwei') && maleOnBoat) {
            logMessage(`王鴻薇在船上抱怨被亂摸，把 ${maleOnBoat.name} 推下船！`);
            killCharacter(maleOnBoat.id, `在船上被王鴻薇推下船`);
            render();
            return;
        }
        // (徐) & !鄭
        if (has('xuxiaoqin') && !has('zhengliwen')) {
            logMessage('徐巧芯在船上瘋狂罵人，沒人敢開船！');
            return;
        }
        
        // 4. 羅智強賣書檢查
        if (has('luozhiqiang') && boatSize === 2) {
            const luo = findCharById('luozhiqiang');
            const otherChar = boatChars.find(c => c.id !== 'luozhiqiang');

            if (otherChar.money < 100) {
                logMessage(`${otherChar.name} 沒錢 ($${otherChar.money}萬) 買書，把羅智強丟下船！`);
                killCharacter('luozhiqiang', `被 ${otherChar.name} 丟下船 (沒錢買書)`);
                render();
                return;
            } else {
                otherChar.money -= 100;
                luo.money += 100; // 羅智強錢增加 (非規則，但合理)
                logMessage(`羅智強兜售書本，${otherChar.name} 支付 100 萬，剩下 $${otherChar.money}萬。`);
            }
        }

        // --- B. 執行移動 (Execute Move) ---
        const departingBank = gameState.boatLocation;
        const arrivalBank = (departingBank === 'taiwan') ? 'china' : 'taiwan';
        gameState.boatLocation = arrivalBank;
        logMessage(`船隻從 ${departingBank} 開往 ${arrivalBank}...`);

        // --- C. 抵達後檢查 (Post-Move Checks) ---
        
        // 1. 將船上的人移到抵達的岸上
        const arrivingChars = [...boatChars]; // 複製一份
        arrivingChars.forEach(char => {
            char.location = arrivalBank;

            // 檢查是否首次抵達中國
            if (arrivalBank === 'china' && !gameState.chinaArrivals.includes(char.id)) {
                gameState.chinaArrivals.push(char.id);
                logMessage(`${char.name} 是第 ${gameState.chinaArrivals.length} 位抵達中國的。`);

                // 鄭麗文計時器檢查
                if (char.id === 'zhengliwen' && gameState.chinaArrivals.length > 5) {
                    logMessage('鄭麗文是第 ' + gameState.chinaArrivals.length + ' 位抵達的，她大怒弄沉了船！');
                    handleSinking('zhengliwen'); // 觸發沈船
                }
            }
        });
        
        // 2. 檢查台灣岸上 (船剛離開)
        checkTaiwanBankRules(departingBank);

        // 3. 檢查中國岸上 (船剛抵達)
        checkChinaBankRules(arrivalBank);

        // --- D. 結束回合 ---
        checkGameEnd(); // 檢查遊戲是否勝利或失敗
        render();       // 重新繪製畫面
    }

    /**
     * 檢查台灣岸上的規則 (王鴻薇)
     */
    function checkTaiwanBankRules(bank) {
        if (bank !== 'taiwan' || gameState.isGameOver) return; // 只有船剛離開台灣時才檢查

        const taiwanChars = getCharsAtLocation('taiwan');
        const wangOnTaiwan = taiwanChars.some(c => c.id === 'wanghongwei' && c.isAlive);
        if (!wangOnTaiwan) return; // 王鴻薇不在台灣，沒事

        // 檢查壓制者是否 "全都不在" 台灣
        const protectorOnTaiwan = taiwanChars.some(c => WANG_PROTECTORS.includes(c.id) && c.isAlive);
        if (!protectorOnTaiwan) {
            // 王鴻薇發動攻擊！
            const maleVictims = taiwanChars.filter(c => MALE_IDS.includes(c.id) && c.isAlive);
            if (maleVictims.length > 0) {
                const victim = maleVictims[Math.floor(Math.random() * maleVictims.length)]; // 隨機挑一個
                logMessage(`(羅、傅、韓、朱) 都不在台灣，王鴻薇失控，將 ${victim.name} 推入台灣海峽！`);
                killCharacter(victim.id, '在台灣岸上被王鴻薇推入海');
            }
        }
    }

    /**
     * 檢查中國岸上的規則 (翁曉玲)
     */
    function checkChinaBankRules(bank) {
        if (bank !== 'china' || gameState.isGameOver) return; // 只有船剛抵達中國時才檢查
        
        const chinaChars = getCharsAtLocation('china');
        const wengOnChina = chinaChars.some(c => c.id === 'wengxiaoling' && c.isAlive);
        if (!wengOnChina) return; // 翁曉玲不在中國，沒事

        // 檢查保護者 (傅, 鄭) 是否在場
        const protectorOnChina = chinaChars.some(c => (c.id === 'fuqunzhu' || c.id === 'zhengliwen') && c.isAlive);
        if (!protectorOnChina) {
            logMessage('翁曉玲在中國岸上大喊 "就是比你大"，但 (傅, 鄭) 都不在，她被丟入台灣海峽！');
            killCharacter('wengxiaoling', '在中國岸上被丟入海 (無保護者)');
        }
    }

    /**
     * 處理沈船事件
     */
    function handleSinking(reason) {
        logMessage('船沈了！');
        gameState.isGameOver = true; // 暫停遊戲以處理後果

        if (reason === 'fuqunzhu') {
            logMessage('傅崑萁開船，船沈了！');
            // 船上的人全死
            getCharsOnBoat().forEach(char => {
                killCharacter(char.id, '搭上傅崑萁開的船而沈船');
            });

            // 解放軍規則
            const chinaPopulation = getCharsAtLocation('china').length;
            if (chinaPopulation < 5) {
                logMessage(`中國端人數 (${chinaPopulation}) 不足 5 人，解放軍大怒！`);
                getCharsAtLocation('china').forEach(char => {
                    killCharacter(char.id, '因沈船且人數不足5人，被解放軍逼跳海');
                });
            }
        
        } else if (reason === 'zhengliwen') {
            logMessage('鄭麗文太晚到，弄沉了船！');
            killCharacter('zhengliwen', '因太晚抵達而自沉');
            // 台灣的人全死
            getCharsAtLocation('taiwan').forEach(char => {
                killCharacter(char.id, '因鄭麗文沉船，被以叛國罪處刑');
            });
        }
        
        gameState.isGameOver = false; // 處理完畢
        checkGameEnd(); // 檢查遊戲是否結束
    }

    /**
     * 檢查遊戲是否結束 (勝利或失敗)
     */
    function checkGameEnd() {
        if (gameState.isGameOver) return;

        const livingChars = gameState.characters.filter(c => c.isAlive);

        // 失敗：所有人都死了
        if (livingChars.length === 0) {
            logMessage('--- 遊戲結束 ---');
            logMessage('所有立委都死了。台灣人民的勝利！');
            gameState.isGameOver = true;
        }

        // 勝利：所有活著的人都在中國
        const allInChina = livingChars.every(c => c.location === 'china');
        if (livingChars.length > 0 && allInChina) {
            logMessage('--- 遊戲結束 ---');
            logMessage('全員成功抵達中國投誠！玩家勝利！');
            gameState.isGameOver = true;
        }
        
        if (gameState.isGameOver) {
            moveButton.textContent = "重新開始 (Restart)";
            moveButton.style.backgroundColor = '#f44336'; // 變成紅色
            moveButton.removeEventListener('click', handleMoveBoat);
            moveButton.addEventListener('click', initializeGame, { once: true }); // 點擊一次就重置
        }
    }

    // --- 7. 輔助工具 (Helper Functions) ---

    // 紀錄訊息到日誌
    function logMessage(message) {
        console.log(message); // 在開發者主控台也顯示
        gameState.gameLog.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        // 保持日誌最多100條
        if (gameState.gameLog.length > 100) {
            gameState.gameLog.shift();
        }
    }

    // 殺死角色
    function killCharacter(charId, reason) {
        const char = findCharById(charId);
        if (char && char.isAlive) {
            char.isAlive = false;
            char.location = 'dead'; // 標記為死亡
            const deathMessage = `${char.name} 死亡。原因：${reason}`;
            gameState.deathList.push(deathMessage);
            logMessage(deathMessage);
        }
    }

    // 根據 ID 找角色
    function findCharById(id) {
        return gameState.characters.find(c => c.id === id);
    }

    // 獲取在船上的所有角色 (物件陣列)
    function getCharsOnBoat() {
        return gameState.characters.filter(c => c.location === 'boat' && c.isAlive);
    }

    // 獲取在特定地點的所有角色 (物件陣列)
    function getCharsAtLocation(location) {
        return gameState.characters.filter(c => c.location === location && c.isAlive);
    }

    // 計算船上佔用的大小 (陳玉珍算 2)
    function getBoatSize() {
        return getCharsOnBoat().reduce((sum, char) => sum + char.size, 0);
    }

    // --- 8. 遊戲啟動 ---
    initializeGame();
});
