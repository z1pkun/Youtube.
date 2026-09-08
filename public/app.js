const state = { format: "mp4" };

const form = document.getElementById("downloadForm");
const urlInput = document.getElementById("url");
const quality = document.getElementById("quality");
const statusBox = document.getElementById("status");
const downloadButton = document.querySelector(".download");

document.querySelectorAll(".format").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".format").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    state.format = button.dataset.format;
    quality.disabled = state.format === "mp3";
  });
});

document.getElementById("pasteBtn").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error();
    urlInput.value = text.trim();
    showStatus("リンクを貼り付けました。", false);
  } catch {
    showStatus("クリップボードを読み取れませんでした。手動で貼り付けてください。", true);
  }
});

function isYouTubeUrl(value) {
  try {
    const u = new URL(value);
    return [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com"
    ].includes(u.hostname);
  } catch {
    return false;
  }
}

function showStatus(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.remove("hidden");
  statusBox.classList.toggle("error", error);
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const url = urlInput.value.trim();
  if (!isYouTubeUrl(url)) {
    showStatus("有効なYouTube URLを入力してください。", true);
    return;
  }

  downloadButton.disabled = true;
  downloadButton.textContent = "処理中…";

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        format: state.format,
        quality: state.format === "mp4" ? quality.value : null
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "ダウンロードに失敗しました。");
    }

    showStatus(data.message || "完了しました。", false);
  } catch (error) {
    showStatus(error.message || "エラーが発生しました。", true);
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = "ダウンロード";
  }
});
