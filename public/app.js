const state = {
  format: "mp4"
};

const form =
  document.getElementById("downloadForm");

const urlInput =
  document.getElementById("url");

const quality =
  document.getElementById("quality");

const statusBox =
  document.getElementById("status");

const downloadButton =
  document.querySelector(".download");

function showStatus(message, error = false) {
  statusBox.textContent = message;

  statusBox.classList.remove("hidden");

  statusBox.classList.toggle(
    "error",
    error
  );
}

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);

    return [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com"
    ].includes(url.hostname);

  } catch {
    return false;
  }
}

document
  .querySelectorAll(".format")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".format")
          .forEach(item => {
            item.classList.remove("active");
          });

        button.classList.add("active");

        state.format =
          button.dataset.format;

        quality.disabled =
          state.format === "mp3";

      }
    );

  });

document
  .getElementById("pasteBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        const text =
          await navigator.clipboard.readText();

        if (!text) {
          throw new Error();
        }

        urlInput.value =
          text.trim();

        showStatus(
          "URLを貼り付けました。"
        );

      } catch {

        showStatus(
          "クリップボードを読み取れませんでした。",
          true
        );

      }

    }
  );

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const url =
      urlInput.value.trim();

    if (!isYouTubeUrl(url)) {

      showStatus(
        "有効なYouTube URLを入力してください。",
        true
      );

      return;
    }

    downloadButton.disabled = true;

    downloadButton.textContent =
      "処理中…";

    showStatus(
      state.format === "mp3"
        ? "音声を変換しています…"
        : "動画を処理しています…"
    );

    try {

      const response =
        await fetch(
          "/api/download",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              url,
              format:
                state.format,
              quality:
                state.format === "mp4"
                  ? quality.value
                  : null
            })
          }
        );

      if (!response.ok) {

        let message =
          "ダウンロードに失敗しました。";

        try {

          const data =
            await response.json();

          if (data.message) {
            message =
              data.message;
          }

        } catch {}

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const disposition =
        response.headers.get(
          "content-disposition"
        );

      let filename =
        state.format === "mp4"
          ? "download.mp4"
          : "download.mp3";

      if (disposition) {

        const match =
          disposition.match(
            /filename="([^"]+)"/
          );

        if (match) {
          filename =
            match[1];
        }
      }

      const objectUrl =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href =
        objectUrl;

      link.download =
        filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(
          objectUrl
        );
      }, 1000);

      showStatus(
        "ダウンロードが完了しました。"
      );

    } catch (error) {

      console.error(error);

      showStatus(
        error.message ||
        "エラーが発生しました。",
        true
      );

    } finally {

      downloadButton.disabled =
        false;

      downloadButton.textContent =
        "ダウンロード";

    }

  }
);
