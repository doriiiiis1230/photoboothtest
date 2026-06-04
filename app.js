// app.js
document.addEventListener("DOMContentLoaded", () => {
    const pageType = document.body.dataset.page;

    if (pageType === "frame") {
        initFramePage();
    } else if (pageType === "camera") {
        initCameraPage();
    } else if (pageType === "decorate") {
        initDecoratePage();
    } else if (pageType === "save") {
        initSavePage();
    }
});

// 2. 外框選擇頁
function initFramePage() {
    const frames = document.querySelectorAll(".frame-option");
    frames.forEach(frame => {
        frame.addEventListener("click", () => {
            const frameSrc = frame.dataset.frame;
            localStorage.setItem("selectedFrame", frameSrc);
            window.location.href = "camera.html";
        });
    });
}

// 3. 拍照頁邏輯
async function initCameraPage() {
    const video = document.getElementById("video");
    const overlay = document.getElementById("frame-overlay");
    const captureBtn = document.getElementById("capture-btn");

    const selectedFrame = localStorage.getItem("selectedFrame") || "images/frame1.png";
    overlay.src = selectedFrame;

    // 圖片找不到時隱藏破圖圖示
    overlay.onerror = () => {
        overlay.style.display = 'none';
    };

    // 啟動鏡頭
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: 640, height: 360 } 
        });
        video.srcObject = stream;
    } catch (err) {
        alert("無法開啟相機，請確認您使用的是本地伺服器環境(Live Server)並允許了相機權限！");
        return;
    }

    // 拍照按鈕點擊
    captureBtn.addEventListener("click", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");

        // 先畫視訊畫面
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const frameImg = new Image();
        
        // ✨ 智慧判定：只有線上網址才需要 anonymous，本地圖片加了反而會被擋
        if (selectedFrame.startsWith('http')) {
            frameImg.crossOrigin = "anonymous"; 
        }
        frameImg.src = selectedFrame;

        const proceedToNextPage = () => {
            localStorage.setItem("capturedPhoto", canvas.toDataURL("image/png"));
            if (video.srcObject) {
                let tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            window.location.href = "decorate.html";
        };

        // 圖片載入成功
        frameImg.onload = () => {
            ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
            proceedToNextPage();
        };

        // 圖片載入失敗（直接跳轉，防止卡死）
        frameImg.onerror = () => {
            console.warn("未檢測到外框圖片資源，已自動跳過外框合成。");
            proceedToNextPage();
        };
    });
}

// 4. 裝飾頁邏輯
function initDecoratePage() {
    const workspace = document.getElementById("workspace");
    const bgImg = document.getElementById("captured-img");
    const overlay = document.getElementById("frame-overlay-dec");
    const finishBtn = document.getElementById("finish-btn");
    const stickers = document.querySelectorAll(".sticker-item");

    bgImg.src = localStorage.getItem("capturedPhoto") || "";
    overlay.src = localStorage.getItem("selectedFrame") || "images/frame1.png";

    overlay.onerror = () => overlay.style.display = 'none';

    // 點擊選單生成貼圖
    stickers.forEach(sticker => {
        sticker.addEventListener("click", () => {
            const newSticker = document.createElement("img");
            newSticker.src = sticker.dataset.src;
            newSticker.classList.add("draggable-sticker");
            newSticker.style.left = "175px";
            newSticker.style.top = "100px";
            
            newSticker.onerror = () => {
                newSticker.style.display = 'none';
                const textFallback = document.createElement("div");
                textFallback.innerText = sticker.innerText;
                textFallback.classList.add("draggable-sticker");
                textFallback.style.color = "#ffff00";
                textFallback.style.fontSize = "1.5rem";
                textFallback.style.left = "175px";
                textFallback.style.top = "100px";
                workspace.appendChild(textFallback);
                makeElementDraggable(textFallback);
            };

            workspace.appendChild(newSticker);
            makeElementDraggable(newSticker);
        });
    });

    // 拖拽實現
    function makeElementDraggable(elmnt) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        elmnt.onpointerdown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onpointermove = elementDrag;
            document.onpointerup = closeDragElement;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            let newTop = elmnt.offsetTop - pos2;
            let newLeft = elmnt.offsetLeft - pos1;

            if (newTop >= 0 && newTop <= (workspace.clientHeight - elmnt.clientHeight)) {
                elmnt.style.top = newTop + "px";
            }
            if (newLeft >= 0 && newLeft <= (workspace.clientWidth - elmnt.clientWidth)) {
                elmnt.style.left = newLeft + "px";
            }
        }

        function closeDragElement() {
            document.onpointermove = null;
            document.onpointerup = null;
        }
    }

    // 合成最終圖片
    finishBtn.addEventListener("click", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");

        const baseImg = new Image();
        // ✨ 智慧判定：底圖只有是 http 網址時才加跨網域設定（Base64資料不需要）
        if (bgImg.src.startsWith('http')) {
            baseImg.crossOrigin = "anonymous";
        }
        baseImg.src = bgImg.src;
        baseImg.onload = () => {
            ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / workspace.clientWidth;
            const scaleY = canvas.height / workspace.clientHeight;
            const placedStickers = workspace.querySelectorAll(".draggable-sticker");
            
            let loadedCount = 0;
            if (placedStickers.length === 0) {
                saveAndGo();
                return;
            }

            placedStickers.forEach(stk => {
                if (stk.tagName.toLowerCase() === 'div') {
                    ctx.font = "30px Arial";
                    ctx.fillStyle = "#ffff00";
                    ctx.fillText(stk.innerText, stk.offsetLeft * scaleX, (stk.offsetTop + 25) * scaleY);
                    loadedCount++;
                    if (loadedCount === placedStickers.length) saveAndGo();
                } else {
                    const img = new Image();
                    // ✨ 智慧判定：貼圖只有是線上網址時才加跨網域設定
                    if (stk.src.startsWith('http')) {
                        img.crossOrigin = "anonymous";
                    }
                    img.src = stk.src;
                    img.onload = () => {
                        ctx.drawImage(img, stk.offsetLeft * scaleX, stk.offsetTop * scaleY, stk.clientWidth * scaleX, stk.clientHeight * scaleY);
                        loadedCount++;
                        if (loadedCount === placedStickers.length) saveAndGo();
                    };
                    img.onerror = () => {
                        loadedCount++;
                        if (loadedCount === placedStickers.length) saveAndGo();
                    };
                }
            });
        };

        function saveAndGo() {
            localStorage.setItem("finalPhoto", canvas.toDataURL("image/png"));
            window.location.href = "save.html";
        }
    });
}

// 5. 儲存頁
function initSavePage() {
    const resultImg = document.getElementById("result-img");
    const downloadBtn = document.getElementById("download-btn");
    
    const finalData = localStorage.getItem("finalPhoto");
    if (finalData) {
        resultImg.src = finalData;
    }

    downloadBtn.addEventListener("click", () => {
        const link = document.createElement("a");
        link.download = "gyaru-puri.png";
        link.href = resultImg.src;
        link.click();
    });
}