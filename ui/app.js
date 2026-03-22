const RES = (typeof GetParentResourceName === 'function') ? GetParentResourceName() : 'nordtalk_yseries';

const $ = (id) => document.getElementById(id);

const screenHome = $("screenHome");
const screenChat = $("screenChat");
const msgInput = $('msg');

screenChat.classList.add("hidden");
screenHome.classList.add("hidden");

document.getElementById("loginScreen")?.classList.add("hidden");

showLoading();

let desktop = window.matchMedia('(min-width: 720px)').matches;
let typingTimeout = null;

const backBtn = $('btnAppBack');

if (backBtn) backBtn.style.display = "none";

function setBackVisible(v){
  if (!backBtn) return;
  backBtn.style.display = v ? 'grid' : 'none';
}

function applyLayoutMode() {
  if (desktop) {

    // lista sempre visível no desktop
    screenHome.classList.remove('hidden');

    // chat só aparece se existir chat aberto
    if (state.currentChatId) {
      screenChat.classList.remove('hidden');
    } else {
      screenChat.classList.add('hidden');
    }

  } else {

    // mobile
    if (state.currentChatId) {
      screenHome.classList.add('hidden');
      screenChat.classList.remove('hidden');
    } else {
      screenChat.classList.add('hidden');
      screenHome.classList.remove('hidden');
    }

  }
}

function showLoading(){
  const el = document.getElementById("loadingScreen");
  if(el) el.style.display = "flex";
}

function hideLoading(){
  const el = document.getElementById("loadingScreen");
  if(el) el.style.display = "none";
}

window.matchMedia('(min-width: 720px)').addEventListener?.('change', (e) => {
  desktop = !!e.matches;
  applyLayoutMode();
});

function setLogoutVisible(v){
  const btn = document.getElementById("btnLogout");
  if(!btn) return;
  btn.style.display = v ? "block" : "none";
}

function setTabsVisible(v){
  const tabs = document.getElementById("bottomTabs");
  if(!tabs) return;
  tabs.style.display = v ? "flex" : "none";
}

/* =========================
   PROFILE SCREEN
========================= */

const screenProfile = document.getElementById("screenProfile");
const profileAvatar = document.getElementById("profileAvatar");
const profileDropdown = document.getElementById("profileDropdown");

/* =========================
   ABRIR PERFIL
========================= */

function getInitials(name){
  const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function renderAvatar(el, name, avatarUrl){
  if (!el) return;

  const safeName = name || "User";
  const initials = getInitials(safeName);

  el.innerHTML = "";

  if (avatarUrl && avatarUrl.trim() !== "") {

    const img = new Image();
    img.src = avatarUrl.trim();
    img.alt = safeName;

    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "50%";

    img.onerror = () => {
      el.innerHTML = `<span>${escapeHtml(initials)}</span>`;
      el.style.background = avatarColor(safeName);
    };

    el.appendChild(img);
    el.style.background = "transparent";

  } else {

    el.innerHTML = `<span>${escapeHtml(initials)}</span>`;
    el.style.background = avatarColor(safeName);

  }
}

function loadProfile(){

  if(!state.me) return;

  document.getElementById("profileName").value = state.me.name || "";
  document.getElementById("profileBio").value = state.me.bio || "";
  document.getElementById("profileAvatarInput").value = state.me.avatar || "";

  renderAvatar(
    document.getElementById("profileAvatar"),
    state.me.name,
    state.me.avatar
  );

  renderAvatar(
    document.getElementById("profileAvatarLarge"),
    state.me.name,
    state.me.avatar
  );
}

function openProfile(){

  screenHome.classList.add("hidden");
  screenChat.classList.add("hidden");

  screenProfile.classList.remove("hidden");

  setBackVisible(true);

  loadProfile();

}

/* =========================
   DROPDOWN AVATAR
========================= */

if(profileAvatar){

  profileAvatar.addEventListener("click",(e)=>{

    e.stopPropagation();

    if(profileDropdown){
      profileDropdown.classList.toggle("hidden");
    }

  });

}

/* fechar dropdown ao clicar fora */

document.addEventListener("click",()=>{

  if(profileDropdown){
    profileDropdown.classList.add("hidden");
  }

});

/* =========================
   MENU PROFILE
========================= */

const menuProfile = document.getElementById("menuProfile");

if(menuProfile){

  menuProfile.addEventListener("click",()=>{

    if(profileDropdown) profileDropdown.classList.add("hidden");

    openProfile();

  });

}

/* =========================
   MENU LOGOUT
========================= */

const menuLogout = document.getElementById("menuLogout");

if(menuLogout){

  menuLogout.addEventListener("click",()=>{

    if(profileDropdown) profileDropdown.classList.add("hidden");

    logout();

  });

}

function updateHeaderAvatar(){

  if(!state.me) return;

  renderAvatar(
    document.getElementById("profileAvatar"),
    state.me.name,
    state.me.avatar
  );

}

function goHome(){

  state.currentChatId = null;

  setBackVisible(false);
  setLogoutVisible(true);
  setTabsVisible(true);

  screenChat.classList.add("chat-leave");

  setTimeout(()=>{
    screenChat.classList.add("hidden");
    screenChat.classList.remove("chat-leave");
    screenHome.classList.remove("hidden");
    screenProfile?.classList.add("hidden");
  },200);

}

function goChat(){
  if (desktop) return;
  screenHome.classList.add("hidden");
  screenChat.classList.remove("hidden");
}

let state = {
  me: null,
  tab: 'chats',
  chats: [],
  groups: [],
  contacts: [],
  currentChatId: null,
  currentChatTitle: 'Select a chat',
  currentChatMeta: '—',
  messages: []
};

let searchQuery = "";

/* =========================================================
   AUTH STATE
========================================================= */

let pendingVerify = null;

/* ===============================
   SESSION STORAGE
=============================== */

function saveSession(account){
  try{
    if(!account?.phone) return;

    localStorage.setItem("nordtalk_session", JSON.stringify({
      phone: String(account.phone),
      accountId: Number(account.id || 0)
    }));

  }catch(e){}
}

function showGlobalModal(title, message, buttons = []){

  const modal = document.getElementById("globalModal");
  const body = document.getElementById("globalModalBody");
  const footer = document.getElementById("globalModalFooter");

  document.getElementById("globalModalTitle").textContent = title;

  body.innerHTML = message;

  footer.innerHTML = "";

  if(!buttons.length){

    const btn = document.createElement("button");
    btn.textContent = "OK";

    btn.onclick = hideGlobalModal;

    footer.appendChild(btn);

  }else{

    buttons.forEach(b=>{

      const btn = document.createElement("button");

      btn.textContent = b.label;

      if(b.primary) btn.classList.add("primary");

      btn.onclick = () => {

        hideGlobalModal();

        if(b.action) b.action();

      };

      footer.appendChild(btn);

    });

  }

  modal.classList.remove("hidden");
}

function hideGlobalModal(){

  document.getElementById("globalModal").classList.add("hidden");

}

document.getElementById("globalModalClose").onclick = hideGlobalModal;

function loadSession(){
  try{

    const raw = localStorage.getItem("nordtalk_session");
    if(!raw) return null;

    const s = JSON.parse(raw);

    if(!s?.phone) return null;

    return s;

  }catch(e){
    return null;
  }
}

function clearSession(){
  try{
    localStorage.removeItem("nordtalk_session");
  }catch(e){}
}

function post(name, data = {}) {
  return fetch(`https://${RES}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data)
  }).then(r => r.json()).catch(() => ({}));
}

const searchInput = document.getElementById("searchChats");

if(searchInput){

searchInput.addEventListener("input",()=>{

searchQuery = searchInput.value.toLowerCase();
renderList();

});

}

function avatarColor(name){

  const colors = [
    "#25D366","#00a884","#34b7f1","#ff6b6b",
    "#feca57","#5f27cd","#54a0ff","#1dd1a1",
    "#ee5253","#ff9f43"
  ];

  let hash = 0;

  for(let i=0;i<name.length;i++){
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];

}

function fmtTime(s) {
  if (!s) return '';
  try {
    const d = new Date(s.replace(' ', 'T') + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function showModal(title, bodyEl, footerEl) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = '';
  $('modalFooter').innerHTML = '';
  $('modalBody').appendChild(bodyEl);
  $('modalFooter').appendChild(footerEl);
  $('modal').classList.remove('hidden');
}

function updateGlobalUnread(){
    let total = 0;
    state.chats.forEach(c=>{
    total += (c.unread || 0);
  });
    const badge = document.getElementById("globalUnread");
  if(!badge) return;
  if(total > 0){
    badge.textContent = total;
    badge.classList.remove("hidden");
  }else{
    badge.classList.add("hidden");
  }
}

function hideModal() { $('modal').classList.add('hidden'); }

async function setTab(tab) {

  state.tab = tab;

  document.querySelectorAll('.segBtn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );

  if(tab === "contacts"){
    const res = await post("nordtalk:getContacts");
    if(res?.ok){
      state.contacts = res.contacts || [];
    }
  }

  renderList();
  goHome(); // ⭐ importante
}

function showInviteModal(contact){

  const body = document.createElement("div");
  body.innerHTML = `
    <p style="margin-bottom:10px;">
      <b>${contact.name || contact.phone}</b> não está registado no NordTalk.
    </p>
    <p>Podes convidar este contacto para instalar a aplicação.</p>
  `;

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.gap = "8px";
  footer.style.justifyContent = "flex-end";

  const closeBtn = document.createElement("button");
  closeBtn.className = "iconBtn";
  closeBtn.innerText = "Fechar";
  closeBtn.onclick = hideModal;

  const inviteBtn = document.createElement("button");
  inviteBtn.className = "sendBtn";
  inviteBtn.innerText = "Convidar";

  inviteBtn.onclick = async () => {

    await post("nordtalk:inviteSMS", {
      phone: contact.phone
    });

    hideModal();

  };

  footer.appendChild(closeBtn);
  footer.appendChild(inviteBtn);

  showModal("Contacto não registado", body, footer);
}

function renderList() {
  const list = $('list');
  if (!list) return;
  list.innerHTML = '';
  /* =========================
     CHATS
  ========================= */
  if (state.tab === 'chats') {
    /* ordenar chats por última atividade */
    state.chats.sort((a, b) => {
      const ta = new Date(a.last_time || a.created_at || 0).getTime() || 0;
      const tb = new Date(b.last_time || b.created_at || 0).getTime() || 0;
      return tb - ta;
    });

    if (!state.chats.length) {
      const e = document.createElement('div');
      e.className = 'note';
      e.textContent = 'No chats yet. Create a new chat.';
      list.appendChild(e);
      return;
    }
    for (const c of state.chats) {
      const it = document.createElement('div');
      it.className = 'card';
      it.dataset.chatId = c.id;

      const peer = c.peer || {};

      const name = (peer.name || peer.phone) || `Chat #${c.id}`;
      const msg = c.last_message || '—';
      const time = fmtTime(c.last_time || c.created_at);
      const unread = c.unread || 0;

      const avatarHTML = peer.avatar && String(peer.avatar).trim() !== ""
        ? `<img src="${String(peer.avatar).trim()}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.innerHTML='<span>${escapeHtml(getInitials(name))}</span>'; this.parentNode.style.background='${avatarColor(name)}';">`
        : `<span>${escapeHtml(getInitials(name))}</span>`;

      it.innerHTML = `
        <div class="avatar" style="background:${avatarColor(name)}">
          ${avatarHTML}
        </div>

        <div class="chatContent">
          <div class="row">
            <div class="name">${escapeHtml(name)}</div>
            <div class="time">${escapeHtml(time)}</div>
          </div>

          <div class="preview">${escapeHtml(msg)}</div>
        </div>

        ${unread ? `<div class="unreadBadge">${unread}</div>` : ""}
      `;

      it.addEventListener('click', () => {
        openChat(c.id, name, peer.phone || '');
      });

      list.appendChild(it);

    }
    return;
  }


  /* =========================
     GROUPS
  ========================= */

  if (state.tab === 'groups') {
    if (!state.groups || !state.groups.length) {
      const e = document.createElement('div');
      e.className = 'note';
      e.textContent = 'No groups yet. Create a group.';
      list.appendChild(e);
      return;
    }

    for (const g of state.groups) {
      const name = g.name || ('Group #' + g.id);
      const it = document.createElement('div');
      it.className = 'card';
      it.innerHTML = `
        <div class="avatar" style="background:${avatarColor(name)}">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div class="chatContent">
          <div class="row">
            <div class="name">${escapeHtml(name)}</div>
            <div class="time">${escapeHtml(g.my_role || '')}</div>
          </div>
          <div class="preview">Group chat</div>
        </div>
      `;
      list.appendChild(it);
    }
    return;
  }


  /* =========================
     CONTACTS
  ========================= */

  if (state.tab === 'contacts') {
    if (!state.contacts || !state.contacts.length) {
      const e = document.createElement('div');
      e.className = 'note';
      e.textContent = 'No contacts yet.';
      list.appendChild(e);
      return;
    }
    for (const c of state.contacts) {
      const name = c.name || c.phone;
      const it = document.createElement('div');
      it.className = 'card';
      it.innerHTML = `
        <div class="avatar" style="background:${avatarColor(name)}">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div class="chatContent">
          <div class="row">
            <div class="name">${escapeHtml(name)}</div>
          </div>
          <div class="preview">${escapeHtml(c.phone)}</div>
        </div>
      `;
      it.onclick = async () => {
        const res = await post("nordtalk:createChat", { phone: c.phone });
        // contacto não registado
        if(!res?.ok){
          // qualquer erro -> mostrar convite
          showInviteModal(c);
          return;
        }
        const chatId = res.chatId || res.chat?.id;

        if(!chatId){
          return;
        }
        const exists = state.chats.find(ch => ch.id == chatId);
        if(!exists){
          state.chats.unshift({
            id: chatId,
            peer:{
              name:c.name,
              phone:c.phone
            },
            last_message:"",
            last_time:new Date().toISOString()
          });
        }
        openChat(chatId, c.name || c.phone, c.phone);
      };
      list.appendChild(it);
    }
  }
  updateGlobalUnread();
}

function renderChat() {

  $('chatTitle').textContent = state.currentChatTitle;
  $('chatMeta').textContent = state.currentChatMeta;
  
  const box = $('messages');
  if(!box) return;
  box.innerHTML = '';

  for (const m of state.messages) {

    const isMe = (state.me && m.sender_id == state.me.id);

    const b = document.createElement('div');
    b.className = 'bubble' + (isMe ? ' me' : '');

    let status = '';

    if (isMe) {

      if (m._sending) status = "✓";
      else if (m._seen) status = "✓✓";
      else if (m._delivered) status = "✓✓";
      else status = "✓";

    }

    const sender = isMe ? '' : (m.sender_name || m.sender_phone || '');

    b.innerHTML = `
      <div>${escapeHtml(m.content || '')}</div>
      <div class="bmeta">
        ${escapeHtml(sender)} • ${escapeHtml(fmtTime(m.created_at))}
        ${isMe ? `<span class="msgStatus">${status}</span>` : ""}
      </div>
    `;

    box.appendChild(b);
  }

  scrollChatToBottom();

}

/* =========================================================
   BOOTSTRAP
========================================================= */

async function bootstrap(){

  showLoading();

  const start = Date.now(); // tempo inicial

  const sess = loadSession();

  if(sess?.phone){

    const res = await post("nordtalk:restoreSession", {
      phone: sess.phone
    });

    if(res?.ok && res.account){

      state.me = res.account;
      updateHeaderAvatar();
      $('meLine').textContent =
        `${res.account.name || 'You'} • ${res.account.phone}`;

      await refreshAll();

      setTab('chats');
      applyLayoutMode();
      setLogoutVisible(true);
      setBackVisible(false);

      hideLogin();
      screenHome.classList.remove("hidden");

      // garantir loading mínimo
      const elapsed = Date.now() - start;
      const minTime = 1200;

      if(elapsed < minTime){
        await new Promise(r => setTimeout(r, minTime - elapsed));
      }

      hideLoading();
      return;
    }
  }

  // sem sessão

  const elapsed = Date.now() - start;
  const minTime = 1200;

  if(elapsed < minTime){
    await new Promise(r => setTimeout(r, minTime - elapsed));
  }

  hideLoading();
  showLogin();
}

async function refreshAll() {

  const chats = await post('nordtalk:listChats', {});
  if (chats.ok) state.chats = chats.chats || [];

  const groups = await post('nordtalk:listGroups', {});
  if (groups.ok) state.groups = groups.groups || [];

  const contacts = await post('nordtalk:getContacts', {});
  if (contacts.ok) state.contacts = contacts.contacts || [];

  
  hideLoading();
  renderList();
}

function scrollChatToBottom(force = false) {
  const box = $('messages');
  if (!box) return;

  const doScroll = () => {
    box.scrollTop = box.scrollHeight;
  };

  if (force) {
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 30);
    setTimeout(doScroll, 120);
    return;
  }

  const nearBottom =
    box.scrollHeight - box.scrollTop - box.clientHeight < 80;

  if (nearBottom) {
    doScroll();
  }
}

async function openChat(chatId, title, phone) {

  state.currentChatId = chatId;

  setLogoutVisible(false);
  setTabsVisible(false);

  state.currentChatTitle = title;
  state.currentChatMeta = phone ? `DM • ${phone}` : 'DM';

  let resp = null;

  try {
    resp = await post('nordtalk:getMessages', { chatId });
  } catch(e) {
    console.error("getMessages error", e);
  }

  state.messages = (resp && resp.ok && Array.isArray(resp.messages))
    ? resp.messages
    : [];

  post("nordtalk:messageRead", { chatId });

  renderChat();

  screenChat.classList.remove("hidden");
  screenChat.classList.add("chat-enter");

  setTimeout(() => {
    screenChat.classList.remove("chat-enter");
  }, 250);

  goChat();
  setBackVisible(true);

  // garantir sempre scroll até à última mensagem
  scrollChatToBottom(true);

  setTimeout(() => {
    const input = $('msg');
    if (input) input.focus();
  }, 120);
}

async function sendMessage() {

  const chatId = state.currentChatId;
  const input = $('msg');

  if (!chatId || !input || !state.me) return;

  const text = (input.value || '').trim();
  if (!text) return;

  /* reset altura do input */

  input.style.height = "auto";
  input.value = '';

  /* criar mensagem temporária */

  const tempId = "temp_" + Date.now();

  const tempMessage = {
    id: tempId,
    chat_id: chatId,
    sender_id: state.me.id,
    sender_name: state.me.name,
    sender_phone: state.me.phone,
    content: text,
    created_at: new Date().toISOString().slice(0,19).replace("T"," "),
    _sending: true
  };

  /* garantir array */

  state.messages = state.messages || [];

  state.messages.push(tempMessage);

  renderChat();

  /* scroll automático */

  const box = $('messages');

  if (box) {

    box.scrollTo({
      top: box.scrollHeight,
      behavior: "smooth"
    });

  }

  /* atualizar preview do chat */

  const chat = state.chats.find(c => c.id == chatId);

  if (chat) {

    chat.last_message = text;
    chat.last_time = new Date().toISOString();

    state.chats = [
      chat,
      ...state.chats.filter(c => c.id != chatId)
    ];

    if (state.tab === 'chats') {
      renderList();
    }

  }

  /* enviar para servidor */

  try {

    const resp = await post('nordtalk:sendMessage', { chatId, text });

    if (!resp || !resp.ok) {

      /* erro → restaurar mensagem no input */

      input.value = text;

      const msg = state.messages.find(m => m.id === tempId);

      if (msg) msg._sending = false;

      renderChat();

    }

  } catch (err) {

    console.error("sendMessage error", err);

  }

}

function newChatModal() {

  const body = document.createElement("div");
  body.className = "field";

  body.innerHTML = `
    <label>Phone number</label>
    <input id="newChatPhone" placeholder="Enter phone number" />
  `;

  const footer = document.createElement("div");

  footer.style.display = "flex";
  footer.style.justifyContent = "space-between";
  footer.style.alignItems = "center";
  footer.style.width = "100%";
  footer.style.marginTop = "12px";

  const cancel = document.createElement("button");
  cancel.className = "iconBtn";
  cancel.innerText = "Cancel";
  cancel.onclick = hideModal;

  const create = document.createElement("button");
  create.className = "sendBtn";
  create.innerText = "Create";

  footer.appendChild(cancel);
  footer.appendChild(create);

  create.onclick = async () => {

    const phone = $('newChatPhone').value.trim();

    if (!phone) return;

    const resp = await post('nordtalk:createChat', { phone });

    if (resp.ok) {
      hideModal();
      await refreshAll();
    }

  };

  footer.appendChild(cancel);
  footer.appendChild(create);

  showModal("New Chat", body, footer);
}

function newGroupModal() {
  const body = document.createElement('div');
  body.className = 'field';
  body.innerHTML = `
    <label>Group name</label>
    <input id="newGroupName" placeholder="e.g. Noctavia Staff" />
  `;

  const footer = document.createElement('div');
  footer.style.display = 'contents';

  const cancel = document.createElement('button');
  cancel.className = 'iconBtn';
  cancel.textContent = '✖';
  cancel.onclick = hideModal;

  const create = document.createElement('button');
  create.className = 'sendBtn';
  create.textContent = 'Create';
  create.onclick = async () => {
    const name = (document.getElementById('newGroupName').value || '').trim();
    const resp = await post('nordtalk:createGroup', { name });
    if (resp.ok) {
      hideModal();
      await refreshAll();
      setTab('groups');
    }
  };

  footer.appendChild(cancel);
  footer.appendChild(create);
  showModal('Create Group', body, footer);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* Events */
document.querySelectorAll('.segBtn').forEach(b => {
  b.addEventListener('click', () => {
    setTab(b.dataset.tab);
    goHome();
  });
});

$('btnNewChat').addEventListener('click', () => {
  if (state.tab === 'chats') newChatModal();
  else newGroupModal();
});

$('btnBack').addEventListener('click', () => goHome());

$('btnAppBack').addEventListener('click', () => {
  // só volta para a lista
  goHome();
});

$('btnLogout')?.addEventListener('click', () => {
  logout();
});

$('btnSend').addEventListener('click', sendMessage);
$('msg').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    sendMessage();
  }
});

$('modalClose').addEventListener('click', hideModal);
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') hideModal(); });

/* Realtime */
window.addEventListener('message', (event) => {

  const msg = event.data;
  if (!msg || !msg.action) return;

  /* =========================
     NOVA MENSAGEM
  ========================= */

  if (msg.action === 'nordtalk:newMessage') {

    const { chatId, message } = msg.data || {};
    if (!chatId || !message) return;

    const isMe = state.me && message.sender_id == state.me.id;

    // aplicar estado vindo da DB
    message._delivered = message.delivered == 1;
    message._seen = message.seen == 1;

    // marcar como entregue quando recebida
    if (!isMe) {
      post("nordtalk:messageDelivered", {
        msgId: message.id
      });
    }

    if (state.currentChatId == chatId) {
      const chat = state.chats.find(c=>c.id==chatId);

      if(chat && state.currentChatId !== chatId){
        chat.unread = (chat.unread || 0) + 1;
      }

      if (isMe) {

        // substituir mensagem temporária
        const temp = state.messages.find(m =>
          m._sending && m.content === message.content
        );

        if (temp) {
          Object.assign(temp, message);
          temp._sending = false;
          temp._delivered = true;
        } else {
          state.messages.push(message);
        }

      } else {

        state.messages.push(message);

        // chat aberto = mensagem lida
        post("nordtalk:messageRead", {
          chatId: chatId
        });

      }

      renderChat();

      // scroll inteligente
      const box = $('messages');

      const nearBottom =
      box.scrollHeight - box.scrollTop - box.clientHeight < 80;

      if (nearBottom) {

        box.scrollTo({
          top: box.scrollHeight,
          behavior: "smooth"
        });

      }
    }

    // atualizar lista de chats
    const chat = state.chats.find(c => c.id == chatId);

    if (chat) {

      chat.last_message = message.content;
      chat.last_time = message.created_at;

      state.chats = [
        chat,
        ...state.chats.filter(c => c.id != chatId)
      ];

      if (state.tab === 'chats') renderList();

    } else {

      refreshAll();

    }

  }

  /* =========================
     MESSAGE DELIVERED
  ========================= */

  if (msg.action === 'nordtalk:messageDelivered') {

    const msgId = msg.data?.msgId;
    if (!msgId) return;

    const m = state.messages.find(m => m.id == msgId);

    if (m) {
      m._sending = false;
      m._delivered = true;
      renderChat();
    }

  }

  /* =========================
     MESSAGE READ
  ========================= */

  if (msg.action === 'nordtalk:messageRead') {

    const chatId = msg.data?.chatId;
    if (!chatId) return;

    if (state.currentChatId == chatId) {

      state.messages.forEach(m => {
        if (m.sender_id == state.me.id) {
          m._delivered = true;
          m._seen = true;
        }
      });

      renderChat();
    }

  }

  /* =========================
     TYPING
  ========================= */

  if (msg.action === 'nordtalk:typing') {

    const data = msg.data || {};
    const chatId = data.chatId;
    if (!chatId) return;

    if (chatId === state.currentChatId) {

      $('chatMeta').textContent = "typing...";

      clearTimeout(typingTimeout);

      typingTimeout = setTimeout(() => {
        $('chatMeta').textContent = state.currentChatMeta;
      }, 2000);

    }

  }

});

/* =========================================================
   LOGIN UI
========================================================= */

function showLogin(){
  document.getElementById("loginScreen")?.classList.remove("hidden");
}

function hideLogin(){
  document.getElementById("loginScreen")?.classList.add("hidden");
}

function showVerify(){
  document.getElementById("loginForm")?.classList.add("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
  document.getElementById("verifyForm")?.classList.remove("hidden");
}

function showLoginForm(){
  document.getElementById("loginForm")?.classList.remove("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
  document.getElementById("verifyForm")?.classList.add("hidden");
}

function showRegister(){
  document.getElementById("loginForm")?.classList.add("hidden");
  document.getElementById("registerForm")?.classList.remove("hidden");
  document.getElementById("verifyForm")?.classList.add("hidden");
}

/* =========================================================
   LOGIN
========================================================= */

async function login(){

  const phone = $('loginPhone')?.value.trim();

  if(!phone) return;

  const res = await post("nordtalk:login", { phone });

  if(!res){
    showGlobalModal("Erro", "Erro de ligação.");
    return;
  }

  // ✔ CONTA VERIFICADA → entra direto
  if(res.ok){

    state.me = res.account;
    updateHeaderAvatar();
    saveSession(res.account);

    hideLogin();

    $('meLine').textContent =
      `${res.account.name || 'You'} • ${res.account.phone}`;

    showLoading();
    await refreshAll();
    hideLoading();

    screenHome.classList.remove("hidden"); // ⭐ mostrar chats

    setTab('chats');
    applyLayoutMode();
    setLogoutVisible(true);
    setBackVisible(false);

    return;
  }

  // ❗ CONTA NÃO VERIFICADA
  if(res.error === "email_not_verified"){

    pendingVerify = { phone };

    showVerify();

    return;
  }

  // ❌ OUTROS ERROS
  if(res.error === "not_found"){
    showGlobalModal(
    "Conta não encontrada",
    "O número não está registado no NordTalk."
    );
    return;
  }

  showGlobalModal("Erro ao fazer login.");

}

/* =========================================================
   REGISTER
========================================================= */

async function register(){

  const name  = $('regName')?.value.trim();
  const phone = $('regPhone')?.value.trim();
  const email = $('regEmail')?.value.trim();

  if(!name || !phone || !email){
    showGlobalModal("Nao Foi Possivel Criar Conta","Preenche todos os campos.");
    return;
  }

  const res = await post("nordtalk:register", {
    name,
    phone,
    email
  });

  if(!res?.ok){

    if(res.error === "exists"){
      showGlobalModal("Nao Foi Possivel Criar Conta","Este número já está registado.");
      return;
    }

    showGlobalModal("Nao Foi Possivel Criar Conta","Erro ao criar conta.");
    return;
  }

  pendingVerify = { phone };

  showVerify();
}

/* =========================================================
   VERIFY EMAIL
========================================================= */

async function verifyCode(){

  const code = $('verifyCode')?.value.trim();

  if(!code){
    showGlobalModal("Verificação","Insere o código.");
    return;
  }

  showLoading();

  const res = await post("nordtalk:verifyEmail", {
    phone: pendingVerify?.phone,
    code
  });

  if(!res?.ok){

    hideLoading();

    if(res.error === "invalid_code"){
      showGlobalModal(
      "Código inválido",
      "O código introduzido não é válido."
      );
      return;
    }

    showGlobalModal("Erro","Erro na verificação.");
    return;
  }

  state.me = res.account;
  updateHeaderAvatar();
  saveSession(res.account);

  hideLogin();

  $('meLine').textContent =
    `${res.account.name || 'You'} • ${res.account.phone}`;

  await refreshAll();

  screenHome.classList.remove("hidden");

  setTab('chats');
  applyLayoutMode();
  setLogoutVisible(true);
  setBackVisible(false);

  hideLoading();
}

/* =========================================================
   LOGOUT
========================================================= */

function logout(){

  clearSession();

  state.me = null;

  showLogin();
}

/* =========================================================
   EVENTS
========================================================= */

$('loginBtn')?.addEventListener('click', login);
$('registerBtn')?.addEventListener('click', register);
$('verifyBtn')?.addEventListener('click', verifyCode);
$('msg').addEventListener('input', () => {

  if (!state.currentChatId) return;

  post("nordtalk:typing", {
    chatId: state.currentChatId
  });

});

const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const emojiContainer = document.getElementById("emojiContainer");

/* =========================
   EMOJI CATEGORIES
========================= */

const emojiCategories = {

smileys:[
"😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","😘","🥰","😗","😙","😚",
"🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","😯","😪","😫","🥱","😴"
],

love:[
"❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘"
],

hands:[
"👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🙏"
],

food:[
"🍎","🍌","🍇","🍉","🍓","🍒","🍑","🥝","🍍","🥭","🍕","🍔","🍟","🌭","🍿","🥗","🍣","🍜","🍩","🍪"
],

animals:[
"🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦"
],

activities:[
"⚽","🏀","🏈","⚾","🎾","🏐","🎮","🎧","🎤","🎵","🎶","🏆","🥇","🥈","🥉","🎉","🎊","🎈"
]

};


/* =========================
   RENDER EMOJIS
========================= */

function loadEmojiCategory(cat){
emojiContainer.innerHTML="";
emojiCategories[cat].forEach(e=>{
const span=document.createElement("span");
span.textContent=e;
span.addEventListener("click",()=>{
msgInput.value+=e;
msgInput.focus();
msgInput.style.height="auto";
msgInput.style.height=msgInput.scrollHeight+"px";
emojiPicker.classList.add("hidden");
});
emojiContainer.appendChild(span);

});

}


/* =========================
   TAB EVENTS
========================= */

document.querySelectorAll(".emojiTabs button").forEach(btn=>{
btn.addEventListener("click",()=>{
loadEmojiCategory(btn.dataset.cat);
});

});


/* =========================
   OPEN PICKER
========================= */

if(emojiBtn){
emojiBtn.addEventListener("click",(e)=>{
e.stopPropagation();
emojiPicker.classList.toggle("hidden");
loadEmojiCategory("smileys");

});

}


/* =========================
   CLOSE OUTSIDE
========================= */

document.addEventListener("click",(e)=>{
if (emojiPicker && emojiBtn &&
    !emojiPicker.contains(e.target) &&
    !emojiBtn.contains(e.target)) {

  emojiPicker.classList.add("hidden");

}

});

msgInput.addEventListener("input", () => {

  msgInput.style.height = "auto";
  msgInput.style.height = msgInput.scrollHeight + "px";

});

document.getElementById("goRegister")?.addEventListener("click", showRegister);
document.getElementById("goLogin")?.addEventListener("click", showLoginForm);

/* =========================
   INPUT FOCUS CONTROL
========================= */

let typingLockActive = false;

function isTypingElement(el) {
  if (!el) return false;
  if (el.tagName === "INPUT") return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function setTypingLock(active) {
  if (typingLockActive === active) return;
  typingLockActive = active;

  fetch(`https://${RES}/toggle-NuiFocusKeepInput`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(!active)
  }).catch(() => {});
}

window.addEventListener("focusin", (e) => {
  if (isTypingElement(e.target)) {
    setTypingLock(true);
  }
}, true);

document.addEventListener("click", () => {
  setTimeout(() => {
    setTypingLock(isTypingElement(document.activeElement));
  }, 0);
}, true);

window.addEventListener("focusout", () => {
  setTimeout(() => {
    setTypingLock(isTypingElement(document.activeElement));
  }, 0);
}, true);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    setTypingLock(false);
  } else {
    setTypingLock(isTypingElement(document.activeElement));
  }
});

window.addEventListener("message", () => {
  setTimeout(() => {
    setTypingLock(isTypingElement(document.activeElement));
  }, 0);
});

window.addEventListener("beforeunload", () => {
  setTypingLock(false);
});

document.getElementById("saveProfile")?.addEventListener("click", async () => {

  const name = document.getElementById("profileName").value.trim();
  const bio = document.getElementById("profileBio").value.trim();
  const avatar = document.getElementById("profileAvatarInput").value.trim();

  const res = await post("nordtalk:updateProfile", {
    name,
    bio,
    avatar
  });

  if(res?.ok){
    state.me.name = name;
    state.me.bio = bio;
    state.me.avatar = avatar;

    renderAvatar(document.getElementById("profileAvatar"), name, avatar);
    renderAvatar(document.getElementById("profileAvatarLarge"), name, avatar);

    document.getElementById("meLine").textContent = `${name || 'You'} • ${state.me.phone}`;
    renderList();
  }

});

bootstrap();
