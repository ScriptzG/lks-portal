/* LKS Systems — shared ticket & document UI helpers (portal.html & dashboard.html) */

function escapeHTML(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function formatDateTime(iso) {
  var d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

/* Compact "2h ago" / "Yesterday" style timestamp for scannable list rows */
function timeAgo(iso) {
  var seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d ago";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusLabel(status) {
  var s = status || "open";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusPillHTML(status) {
  var s = status || "open";
  return '<span class="status-pill ' + s + '"><span class="status-dot"></span>' + statusLabel(s) + "</span>";
}

function priorityBadgeHTML(priority) {
  var p = priority || "normal";
  return '<span class="priority-badge ' + p + '">' + p.charAt(0).toUpperCase() + p.slice(1) + "</span>";
}

/* Small circular identity mark — initial for clients, wordmark for staff */
function avatarHTML(emailOrName, isStaff) {
  if (isStaff) return '<span class="avatar avatar-staff">LKS</span>';
  var initial = (emailOrName || "?").trim().charAt(0).toUpperCase();
  return '<span class="avatar avatar-client">' + escapeHTML(initial) + "</span>";
}

function threadRowHTML(role, who, message, when, isOriginal) {
  var avatar = avatarHTML(who, role === "staff");
  var meta = isOriginal
    ? escapeHTML(who) + " · original message"
    : (role === "staff" ? "LKS Support" : escapeHTML(who)) + (when ? " · " + formatDateTime(when) : "");
  return (
    '<div class="thread-row from-' + role + (isOriginal ? " original" : "") + '">' +
      (role !== "staff" ? avatar : "") +
      '<div class="thread-message' + (isOriginal ? " original" : "") + '">' +
        '<span class="sender">' + meta + "</span>" +
        "<p>" + message + "</p>" +
      "</div>" +
      (role === "staff" ? avatar : "") +
    "</div>"
  );
}

/* Renders the message thread (original ticket + replies) into a container element */
function renderThread(container, ticket, replies) {
  var html = threadRowHTML("client", ticket.user_email, escapeHTML(ticket.message), null, true);

  (replies || []).forEach(function (r) {
    html += threadRowHTML(r.sender_role, r.sender_email, escapeHTML(r.message), r.created_at, false);
  });

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

/* ---------- Documents ---------- */

var DOCUMENT_CATEGORIES = {
  terms: "Terms & Conditions",
  contract: "Contract",
  plan: "Plan",
  invoice: "Invoice",
  other: "Document"
};

function categoryLabel(cat) {
  return DOCUMENT_CATEGORIES[cat] || "Document";
}

function categoryIconHTML() {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' +
    "</svg>"
  );
}

function documentStatusPillHTML(status) {
  if (!status) return "";
  var s = status.toLowerCase();
  var cls = s === "paid" || s === "active" ? "answered" : s === "unpaid" ? "open" : "closed";
  return '<span class="status-pill ' + cls + '"><span class="status-dot"></span>' + escapeHTML(status) + "</span>";
}

function openSignedDocument(client, path, btn) {
  var originalLabel = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = "Opening…"; }
  return client.storage
    .from("client-documents")
    .createSignedUrl(path, 120)
    .then(function (result) {
      if (result.data && result.data.signedUrl) {
        window.open(result.data.signedUrl, "_blank", "noopener");
      } else {
        alert("Couldn't open that document — please try again.");
      }
    })
    .catch(function () {
      alert("Couldn't open that document — please try again.");
    })
    .finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    });
}
