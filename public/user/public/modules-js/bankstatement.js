// Bank Statement module JS
// frontend/modules-js/bankstatement.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bankstatementForm");
  const status = document.getElementById("uploadStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = document.getElementById("bankstatementFile").files[0];
    if (!file) {
      status.textContent = "Please select a file first.";
      console.warn("⚠ No file selected");
      return;
    }

    console.log("📁 File selected:", {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      type: file.type
    });

    const formData = new FormData();
    formData.append("file", file);

    status.textContent = "Uploading... ⏳";
    console.log("📤 Starting upload to /api/bankstatement/upload");

    try {
      const res = await fetch("/api/bankstatement/upload", {
        method: "POST",
        body: formData,
      });

      console.log("📊 Response status:", res.status, res.statusText);

      const data = await res.json();
      console.log("📥 Response data:", data);

      if (res.ok) {
        console.log("✅ Upload successful!");
        status.innerHTML = `✅ Bank statement uploaded successfully!<br><small>Thank you, your file <b>${data.filename}</b> has been received.</small>`;
      } else {
        console.error("❌ Upload failed:", {
          error: data.error,
          message: data.message,
          status: res.status
        });
        status.textContent = `❌ Upload failed: ${data.message || data.error}`;
      }
    } catch (err) {
      console.error("⚠ Network or parsing error:", err);
      status.textContent = "⚠ Something went wrong during upload.";
    }
  });
});
