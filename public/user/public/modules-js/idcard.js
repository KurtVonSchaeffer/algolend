// ID Card module JS

export function bindIdCardUpload() {
  const form = document.getElementById("idcardForm");
  const status = document.getElementById("uploadStatus");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileFront = document.getElementById("idcardFilefront").files[0];
    const fileBack = document.getElementById("idcardFileback").files[0];
    if (!fileFront || !fileBack) {
      status.textContent = "Please select both front and back files.";
      return;
    }

    const formData = new FormData();
    formData.append("filefront", fileFront);
    formData.append("fileback", fileBack);

    status.textContent = "Uploading... ⏳";
    try {
      const res = await fetch("/api/idcard/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        status.innerHTML = `✅ ID card uploaded successfully!<br><small>Thank you, your files <b>${data.filenames.front}</b> and <b>${data.filenames.back}</b> have been received.</small>`;
      } else {
        status.textContent = `❌ Upload failed: ${data.message || data.error}`;
      }
    } catch (err) {
      status.textContent = "❌ Upload failed: Network or server error.";
    }
  });
}
