"use strict";

const WORKER_URL = "https://cold-pond-16b6.santiago-yuriar.workers.dev/";

const STORAGE_KEYS = {
  selectedProducts: "loreal-selected-products",
  direction: "loreal-page-direction",
};

const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const productCount = document.getElementById("productCount");

const selectedProductsList = document.getElementById(
  "selectedProductsList"
);
const selectionSummary = document.getElementById("selectionSummary");
const clearSelectionsButton = document.getElementById(
  "clearSelections"
);
const generateRoutineButton = document.getElementById(
  "generateRoutine"
);

const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const clearChatButton = document.getElementById("clearChat");

const directionToggle = document.getElementById("directionToggle");
const directionText = document.getElementById("directionText");

const productModal = document.getElementById("productModal");
const closeModalButton = document.getElementById("closeModal");
const modalProductImage = document.getElementById(
  "modalProductImage"
);
const modalProductBrand = document.getElementById(
  "modalProductBrand"
);
const modalProductName = document.getElementById(
  "modalProductName"
);
const modalProductCategory = document.getElementById(
  "modalProductCategory"
);
const modalProductDescription = document.getElementById(
  "modalProductDescription"
);
const modalSelectButton = document.getElementById(
  "modalSelectButton"
);

let allProducts = [];
let selectedProductIds = new Set();
let activeModalProductId = null;
let isWaitingForResponse = false;

const systemPrompt = `
You are a friendly and knowledgeable AI beauty advisor for a student-built
L'Oréal product routine application.

Your responsibilities:
- Build routines using the exact products selected by the user.
- Clearly identify product names and brands.
- Put products in a sensible order of use.
- Explain whether each product is for morning, evening, weekly, or as needed.
- Mention when selected products do not naturally belong in one routine.
- Answer follow-up questions using the previous conversation.
- Discuss only skincare, haircare, makeup, fragrance, grooming, sunscreen,
  cosmetic products, and the generated routine.
- Do not diagnose medical conditions or claim to replace a dermatologist.
- Recommend patch testing and following the product label when appropriate.
- Do not invent facts about a selected product.
- When there are possible ingredient conflicts, use careful language and
  suggest introducing products gradually.
- Format routines with readable headings and numbered steps.
- Keep responses useful and reasonably concise.
`.trim();

let conversationHistory = [
  {
    role: "system",
    content: systemPrompt,
  },
];

async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error(
        `Could not load products.json. Status: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.products)) {
      throw new Error(
        "products.json does not contain a valid products array."
      );
    }

    allProducts = data.products;
    restoreSelectedProducts();
    applyFilters();
    updateSelectedProductsDisplay();
  } catch (error) {
    console.error(error);

    productCount.textContent = "Products unavailable";

    productsContainer.innerHTML = `
      <div class="empty-state error-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h3>Products could not be loaded</h3>
        <p>
          Make sure products.json is in the same folder as index.html
          and that you are using Live Server or GitHub Pages.
        </p>
      </div>
    `;
  }
}

function applyFilters() {
  const selectedCategory = categoryFilter.value
    .trim()
    .toLowerCase();

  const searchTerm = productSearch.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter((product) => {
    const categoryMatches =
      !selectedCategory ||
      product.category.toLowerCase() === selectedCategory;

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLowerCase();

    const searchMatches =
      !searchTerm || searchableText.includes(searchTerm);

    return categoryMatches && searchMatches;
  });

  displayProducts(filteredProducts);

  const productWord =
    filteredProducts.length === 1 ? "product" : "products";

  productCount.textContent =
    `${filteredProducts.length} ${productWord} shown`;
}

function displayProducts(products) {
  productsContainer.innerHTML = "";

  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-magnifying-glass"></i>
        <h3>No matching products</h3>
        <p>Try another search term or category.</p>
      </div>
    `;

    return;
  }

  products.forEach((product) => {
    productsContainer.appendChild(createProductCard(product));
  });
}

function createProductCard(product) {
  const card = document.createElement("article");
  const isSelected = selectedProductIds.has(product.id);

  card.className = `product-card${isSelected ? " selected" : ""}`;
  card.dataset.productId = String(product.id);
  card.tabIndex = 0;
  card.setAttribute(
    "aria-label",
    `${product.name} by ${product.brand}. ${
      isSelected ? "Selected." : "Not selected."
    }`
  );
  card.setAttribute("aria-pressed", String(isSelected));

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "product-image-wrapper";

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";

  image.addEventListener("error", () => {
    image.src =
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
          <rect width="100%" height="100%" fill="#f4f4f4"/>
          <text
            x="50%"
            y="50%"
            dominant-baseline="middle"
            text-anchor="middle"
            font-family="Arial"
            font-size="18"
            fill="#666"
          >
            Product Image
          </text>
        </svg>
      `);
  });

  const selectedBadge = document.createElement("span");
  selectedBadge.className = "selected-badge";
  selectedBadge.innerHTML =
    '<i class="fa-solid fa-check"></i> Selected';

  imageWrapper.append(image, selectedBadge);

  const information = document.createElement("div");
  information.className = "product-info";

  const brand = document.createElement("p");
  brand.className = "product-brand";
  brand.textContent = product.brand;

  const name = document.createElement("h3");
  name.textContent = product.name;

  const category = document.createElement("p");
  category.className = "product-category";
  category.textContent = formatCategory(product.category);

  const actions = document.createElement("div");
  actions.className = "product-actions";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "select-product-btn";
  selectButton.textContent = isSelected ? "Remove" : "Select";

  selectButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProductSelection(product.id);
  });

  const detailsButton = document.createElement("button");
  detailsButton.type = "button";
  detailsButton.className = "details-btn";
  detailsButton.innerHTML =
    '<i class="fa-solid fa-circle-info"></i> Details';

  detailsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openProductModal(product.id);
  });

  actions.append(selectButton, detailsButton);
  information.append(brand, name, category, actions);
  card.append(imageWrapper, information);

  card.addEventListener("click", () => {
    toggleProductSelection(product.id);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleProductSelection(product.id);
    }
  });

  return card;
}

function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProducts();
  updateSelectedProductsDisplay();
  applyFilters();
  updateModalSelectButton();
}

function updateSelectedProductsDisplay() {
  selectedProductsList.innerHTML = "";

  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="no-selections">
        <i class="fa-regular fa-heart"></i>
        <p>No products selected yet.</p>
      </div>
    `;

    selectionSummary.textContent =
      "Select products from the grid to begin building your routine.";

    generateRoutineButton.disabled = true;
    clearSelectionsButton.disabled = true;

    return;
  }

  selectedProducts.forEach((product) => {
    const selectedItem = document.createElement("div");
    selectedItem.className = "selected-product-item";

    const image = document.createElement("img");
    image.src = product.image;
    image.alt = "";
    image.loading = "lazy";

    const information = document.createElement("div");
    information.className = "selected-item-info";

    const name = document.createElement("strong");
    name.textContent = product.name;

    const brand = document.createElement("span");
    brand.textContent = product.brand;

    information.append(name, brand);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-product-btn";
    removeButton.setAttribute(
      "aria-label",
      `Remove ${product.name}`
    );
    removeButton.innerHTML =
      '<i class="fa-solid fa-xmark"></i>';

    removeButton.addEventListener("click", () => {
      toggleProductSelection(product.id);
    });

    selectedItem.append(image, information, removeButton);
    selectedProductsList.appendChild(selectedItem);
  });

  const productWord =
    selectedProducts.length === 1 ? "product" : "products";

  selectionSummary.textContent =
    `${selectedProducts.length} ${productWord} selected.`;

  generateRoutineButton.disabled = false;
  clearSelectionsButton.disabled = false;
}

function getSelectedProducts() {
  return allProducts.filter((product) =>
    selectedProductIds.has(product.id)
  );
}

function saveSelectedProducts() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.selectedProducts,
      JSON.stringify([...selectedProductIds])
    );
  } catch (error) {
    console.error("Could not save selected products:", error);
  }
}

function restoreSelectedProducts() {
  try {
    const savedValue = localStorage.getItem(
      STORAGE_KEYS.selectedProducts
    );

    if (!savedValue) {
      return;
    }

    const savedIds = JSON.parse(savedValue);

    if (!Array.isArray(savedIds)) {
      return;
    }

    const validIds = new Set(
      allProducts.map((product) => product.id)
    );

    selectedProductIds = new Set(
      savedIds
        .map(Number)
        .filter((id) => validIds.has(id))
    );
  } catch (error) {
    console.error("Could not restore selected products:", error);
    selectedProductIds = new Set();
  }
}

function clearAllSelections() {
  selectedProductIds.clear();
  saveSelectedProducts();
  updateSelectedProductsDisplay();
  applyFilters();
  updateModalSelectButton();
}

function openProductModal(productId) {
  const product = allProducts.find(
    (item) => item.id === productId
  );

  if (!product) {
    return;
  }

  activeModalProductId = productId;

  modalProductImage.src = product.image;
  modalProductImage.alt = product.name;
  modalProductBrand.textContent = product.brand;
  modalProductName.textContent = product.name;
  modalProductCategory.textContent = formatCategory(
    product.category
  );
  modalProductDescription.textContent = product.description;

  updateModalSelectButton();

  productModal.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  closeModalButton.focus();
}

function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  activeModalProductId = null;
}

function updateModalSelectButton() {
  if (activeModalProductId === null) {
    return;
  }

  const isSelected = selectedProductIds.has(
    activeModalProductId
  );

  modalSelectButton.textContent = isSelected
    ? "Remove from Selected Products"
    : "Add to Selected Products";

  modalSelectButton.classList.toggle(
    "remove-mode",
    isSelected
  );
}

/* --------------------------------------------------
   Routine generation and chat
-------------------------------------------------- */

async function generateRoutine() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    addMessage(
      "assistant",
      "Please select at least one product before generating a routine."
    );

    return;
  }

  const productData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const routineRequest = `
Create a personalized routine using only the selected products below.

Selected product data:
${JSON.stringify(productData, null, 2)}

Requirements:
1. Use the exact product and brand names.
2. Divide the routine into appropriate sections such as morning, evening,
   haircare, makeup, fragrance, or as-needed steps.
3. Put the products in a sensible order.
4. Explain briefly how and when to use each product.
5. Identify products that should not be used together in the same session.
6. If the products belong to unrelated categories, create separate mini-routines.
7. Do not add unselected named products.
8. End with two or three practical safety or usage tips.
`.trim();

  addMessage(
    "user",
    `Generate a routine with my ${selectedProducts.length} selected ${
      selectedProducts.length === 1 ? "product" : "products"
    }.`
  );

  conversationHistory.push({
    role: "user",
    content: routineRequest,
  });

  await requestAssistantResponse();
}

async function handleChatSubmit(event) {
  event.preventDefault();

  const message = userInput.value.trim();

  if (!message || isWaitingForResponse) {
    return;
  }

  userInput.value = "";

  addMessage("user", message);

  conversationHistory.push({
    role: "user",
    content: message,
  });

  await requestAssistantResponse();
}

async function requestAssistantResponse() {
  if (
    !WORKER_URL ||
    WORKER_URL.includes(
      "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE"
    )
  ) {
    addMessage(
      "assistant",
      "Your website is ready, but you still need to paste your deployed Cloudflare Worker URL at the top of script.js."
    );

    return;
  }

  setLoadingState(true);
  const typingMessage = addTypingIndicator();

  try {
    const messagesToSend = [
      conversationHistory[0],
      ...conversationHistory.slice(1).slice(-20),
    ];

    const response = await fetch(WORKER_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        messages: messagesToSend,
      }),
    });

    let responseData;

    try {
      responseData = await response.json();
    } catch {
      throw new Error(
        "The Worker returned a response that was not valid JSON."
      );
    }

    if (!response.ok) {
      throw new Error(
        responseData.error ||
          responseData.message ||
          `Worker request failed with status ${response.status}.`
      );
    }

    const assistantReply = extractAssistantReply(responseData);

    if (!assistantReply) {
      throw new Error(
        "The Worker responded successfully, but no assistant message was found."
      );
    }

    typingMessage.remove();

    addMessage("assistant", assistantReply);

    conversationHistory.push({
      role: "assistant",
      content: assistantReply,
    });
  } catch (error) {
    console.error(error);

    typingMessage.remove();

    addMessage(
      "assistant",
      `I couldn't reach the AI advisor. ${error.message}`
    );
  } finally {
    setLoadingState(false);
  }
}

function extractAssistantReply(data) {
  if (!data) {
    return "";
  }

  if (typeof data.reply === "string") {
    return data.reply.trim();
  }

  if (typeof data.response === "string") {
    return data.response.trim();
  }

  if (typeof data.message === "string") {
    return data.message.trim();
  }

  if (typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  const chatCompletionText =
    data.choices?.[0]?.message?.content;

  if (typeof chatCompletionText === "string") {
    return chatCompletionText.trim();
  }

  if (Array.isArray(chatCompletionText)) {
    return chatCompletionText
      .map((item) => item.text || item.content || "")
      .join("\n")
      .trim();
  }

  if (Array.isArray(data.output)) {
    return data.output
      .flatMap((outputItem) => outputItem.content || [])
      .map((contentItem) => contentItem.text || "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

/* --------------------------------------------------
   Chat UI
-------------------------------------------------- */

function addMessage(role, content) {
  const messageWrapper = document.createElement("div");
  messageWrapper.className = `message-row ${role}-row`;

  const message = document.createElement("div");
  message.className = `chat-message ${role}-message`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Beauty Advisor";

  const messageContent = document.createElement("div");
  messageContent.className = "message-content";
  formatMessageContent(messageContent, content);

  message.append(label, messageContent);
  messageWrapper.appendChild(message);
  chatWindow.appendChild(messageWrapper);

  scrollChatToBottom();

  return messageWrapper;
}

function formatMessageContent(container, content) {
  const lines = String(content).split("\n");

  lines.forEach((line, index) => {
    if (line.trim() === "") {
      container.appendChild(document.createElement("br"));
      return;
    }

    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    container.appendChild(paragraph);

    if (index < lines.length - 1 && lines[index + 1].trim()) {
      paragraph.classList.add("message-line");
    }
  });
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.className = "message-row assistant-row typing-row";

  const bubble = document.createElement("div");
  bubble.className =
    "chat-message assistant-message typing-message";

  bubble.setAttribute("aria-label", "Beauty advisor is typing");

  bubble.innerHTML = `
    <span class="message-label">Beauty Advisor</span>
    <div class="typing-dots" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  row.appendChild(bubble);
  chatWindow.appendChild(row);
  scrollChatToBottom();

  return row;
}

function setLoadingState(isLoading) {
  isWaitingForResponse = isLoading;

  generateRoutineButton.disabled =
    isLoading || selectedProductIds.size === 0;

  sendButton.disabled = isLoading;
  userInput.disabled = isLoading;

  if (isLoading) {
    generateRoutineButton.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Creating Routine...</span>
    `;
  } else {
    generateRoutineButton.innerHTML = `
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <span>Generate My Routine</span>
    `;

    userInput.focus();
  }
}

function resetChat() {
  conversationHistory = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  chatWindow.innerHTML = "";

  addMessage(
    "assistant",
    "Welcome! Select products from the collection and click “Generate My Routine.” Afterward, you can ask me follow-up questions about the routine, skincare, haircare, makeup, grooming, sunscreen, or fragrance."
  );
}

function scrollChatToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function applySavedDirection() {
  const savedDirection =
    localStorage.getItem(STORAGE_KEYS.direction) || "ltr";

  applyDirection(savedDirection);
}

function toggleDirection() {
  const currentDirection =
    document.documentElement.getAttribute("dir") || "ltr";

  const newDirection =
    currentDirection === "ltr" ? "rtl" : "ltr";

  applyDirection(newDirection);

  localStorage.setItem(
    STORAGE_KEYS.direction,
    newDirection
  );
}

function applyDirection(direction) {
  document.documentElement.setAttribute("dir", direction);

  directionText.textContent =
    direction === "ltr" ? "RTL" : "LTR";

  directionToggle.setAttribute(
    "aria-label",
    direction === "ltr"
      ? "Switch to right-to-left layout"
      : "Switch to left-to-right layout"
  );
}

function formatCategory(category) {
  return category
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

categoryFilter.addEventListener("change", applyFilters);
productSearch.addEventListener("input", applyFilters);

clearSelectionsButton.addEventListener(
  "click",
  clearAllSelections
);

generateRoutineButton.addEventListener(
  "click",
  generateRoutine
);

chatForm.addEventListener("submit", handleChatSubmit);
clearChatButton.addEventListener("click", resetChat);

directionToggle.addEventListener("click", toggleDirection);

closeModalButton.addEventListener(
  "click",
  closeProductModal
);

productModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    closeProductModal();
  }
});

modalSelectButton.addEventListener("click", () => {
  if (activeModalProductId !== null) {
    toggleProductSelection(activeModalProductId);
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    productModal.classList.contains("open")
  ) {
    closeProductModal();
  }
});

applySavedDirection();
resetChat();
loadProducts();