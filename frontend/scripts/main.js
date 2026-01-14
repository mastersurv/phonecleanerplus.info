window.addEventListener('load', function () {

  /* loader */

  setTimeout(() => {
    document.querySelector('.page-loader').classList.add('is-close');
  }, 500);

  /* redirects */

  function redirect(url) {
    window.location.href = url;
  }

  let pages = {
    cancel: 'cancel.html',
    welcome: 'welcome.html',
  };

  let toCancelSuccess = document.querySelector('.js-cancel-page');

  if (toCancelSuccess) {
    toCancelSuccess.addEventListener('click', () => {
      redirect(pages.cancel);
    });
  }

  /* menu links */

  const menuLinks = this.document.querySelector('.js-menu-links');

  if (menuLinks) {
    const currentUrl = window.location.href;

    const links = menuLinks.querySelectorAll("a");

    links.forEach((item) => {
      const itemHref = item.getAttribute("href");

      if (currentUrl.includes(itemHref)) {
        links.forEach((el) => {
          el.parentElement.classList.remove("is-active")
        });

        item.parentElement.classList.add("is-active");
      }
    });
  }

  /* check agreements */

  const agreementsCheckboxes = document.querySelectorAll('.js-agreements');
  const activateButtons = document.querySelectorAll('.activate-button');

  if (agreementsCheckboxes.length > 0) {
    agreementsCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function () {
        setMainButtonState(this.checked);
      });
    });
    if (activateButtons) {
      setMainButtonState(true);
    }
  }

  function setMainButtonState(status) {
    agreementsCheckboxes.forEach(checkbox => {
      checkbox.checked = status;
    });
    activateButtons.forEach(button => {
      button.disabled = !status;
    });
  }

  /* handleFormSubmit */

  function handleFormSubmit(form, url, onSuccess, onError) {
    const formData = new FormData(form);

    fetch(url, {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (response.ok) {
          onSuccess(form);
        } else {
          throw new Error(`Server responded with status ${response.status}`);
        }
      })
      .catch(error => {
        onError(error, form);
      });
  }

  /* disabledBtn */

  function disabledBtn(btn) {
    btn.disabled = true;
  }

  /* enabledBtn */

  function enabledBtn(btn) {
    btn.disabled = false;
  }

  /* Payment Method Tabs (Stripe / Paddle) */
  
  function initPaymentTabs() {
    const tabContainers = document.querySelectorAll('.js-payment-tabs');
    
    tabContainers.forEach(container => {
      const tabs = container.querySelectorAll('.payment-tabs__tab');
      const parentSection = container.closest('.payment-info__main');
      
      if (!parentSection) return;
      
      const sections = parentSection.querySelectorAll('.js-payment-section');
      
      tabs.forEach(tab => {
        tab.addEventListener('click', function() {
          const targetTab = this.dataset.tab;
          
          // Update tab states
          tabs.forEach(t => t.classList.remove('is-active'));
          this.classList.add('is-active');
          
          // Update section visibility
          sections.forEach(section => {
            if (section.dataset.section === targetTab) {
              section.classList.add('is-active');
            } else {
              section.classList.remove('is-active');
            }
          });
          
          // Initialize Paddle checkout if switching to Paddle tab
          if (targetTab === 'paddle' && typeof Paddle !== 'undefined') {
            initPaddleCheckoutForSection(parentSection);
          }
        });
      });
    });
  }
  
  initPaymentTabs();

  /* Stripe Elements (inline payments on page) */

  // API base URL for FastAPI backend
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : window.location.origin;

  // Публичный ключ Stripe (тот же аккаунт, что и у secret key на backend)
  let stripe = null;
  let stripeElements = null;
  let cardElement1 = null;
  let cardElement2 = null;
  let paymentRequest = null; // Payment Request для Apple Pay / Google Pay
  
  /* Paddle Checkout */
  
  let paddleInitialized = false;
  let paddleConfig = null;
  
  // Fetch Paddle configuration from backend
  async function fetchPaddleConfig() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/paddle/config`);
      if (!response.ok) {
        console.warn('Paddle not configured on backend');
        return null;
      }
      return await response.json();
    } catch (e) {
      console.warn('Failed to fetch Paddle config:', e);
      return null;
    }
  }
  
  // Initialize Paddle.js
  async function initPaddle() {
    if (paddleInitialized) return true;
    
    if (typeof Paddle === 'undefined') {
      console.warn('Paddle.js is not loaded');
      return false;
    }
    
    paddleConfig = await fetchPaddleConfig();
    
    if (!paddleConfig || !paddleConfig.clientToken) {
      console.warn('Paddle configuration missing');
      return false;
    }
    
    try {
      // Set environment BEFORE Initialize (required for sandbox)
      if (paddleConfig.environment === 'sandbox') {
        Paddle.Environment.set('sandbox');
        console.log('Paddle environment set to sandbox');
      }
      
      Paddle.Initialize({
        token: paddleConfig.clientToken,
        eventCallback: function(event) {
          console.log('Paddle event:', event.name, event.data);
          
          if (event.name === 'checkout.completed') {
            handlePaddleCheckoutComplete(event.data);
          } else if (event.name === 'checkout.closed') {
            console.log('Paddle checkout closed');
          } else if (event.name === 'checkout.error') {
            handlePaddleCheckoutError(event.data);
          }
        },
        checkout: {
          settings: {
            displayMode: 'inline',
            variant: 'one-page',
            theme: 'light',
            locale: 'en'
          }
        }
      });
      
      paddleInitialized = true;
      console.log('Paddle initialized successfully');
      return true;
    } catch (e) {
      console.error('Failed to initialize Paddle:', e);
      return false;
    }
  }
  
  // Initialize Paddle checkout for a specific section
  async function initPaddleCheckoutForSection(parentSection) {
    const initialized = await initPaddle();
    if (!initialized) return;
    
    // Paddle inline checkout will be opened when user clicks the button
    console.log('Paddle ready for checkout in section');
  }
  
  // Open Paddle inline checkout
  async function openPaddleCheckout(containerId, email) {
    const initialized = await initPaddle();
    if (!initialized) {
      alert('Payment system is not available. Please try again later.');
      return;
    }
  
    if (!paddleConfig || !paddleConfig.priceId) {
      console.error('Paddle price ID not configured');
      return;
    }
  
    const container = document.getElementById(containerId);
    console.log('Looking for container:', containerId, 'Found:', container);
  
    if (!container) {
      console.error('Paddle checkout container not found:', containerId);
      return;
    }
  
    // Ensure container is visible and empty
    container.style.display = 'block';
    container.style.minHeight = '450px';
    container.innerHTML = ''; // Clear any previous content
  
    // Also ensure parent section is visible
    const parentSection = container.closest('.payment-section');
    if (parentSection) {
      parentSection.classList.add('is-active');
      parentSection.style.display = 'block';
    }
  
    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Wait a bit more after update
    await new Promise(resolve => setTimeout(resolve, 100));
  
    try {
      Paddle.Checkout.open({
        items: [{ priceId: paddleConfig.priceId, quantity: 1 }],
        customer: email ? { email: email } : undefined,
        settings: {
          displayMode: 'inline',
          frameTarget: containerId,
          frameInitialHeight: '450',
          frameStyle: 'width: 100%; min-width: 312px; background-color: transparent; border: none;',
        },
        customData: {
          source: 'website',
        }
      });
  
      console.log('Paddle checkout opened');
    } catch (e) {
      console.error('Failed to open Paddle checkout:', e);
      const errorEl = document.getElementById(containerId.replace('container', 'errors'));
      if (errorEl) {
        errorEl.textContent = 'Failed to load payment form. Please try again.';
      }
    }
  }
  
  // Handle successful Paddle checkout
  function handlePaddleCheckoutComplete(data) {
    console.log('Paddle checkout completed:', data);
    
    // Show success message and redirect
    setTimeout(() => {
      redirect('welcome.html');
    }, 1000);
  }
  
  // Handle Paddle checkout error
  function handlePaddleCheckoutError(data) {
    console.error('Paddle checkout error:', data);
    
    // Show error modal if available
    const declineModal = document.getElementById('modal-decline');
    if (declineModal && typeof modal !== 'undefined') {
      modal.open('#modal-decline');
    }
  }
  
  // Initialize Paddle checkout buttons
  function initPaddleCheckoutButtons() {
    const buttons = document.querySelectorAll('.js-paddle-checkout-btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        
        const containerId = this.dataset.container;
        const section = this.closest('.paddle-checkout-container');
        const emailInput = section?.querySelector('.js-paddle-email');
        const agreementCheckbox = section?.querySelector('.js-paddle-agreements');
        
        // Check agreement
        if (agreementCheckbox && !agreementCheckbox.checked) {
          alert('Please agree to the Terms of Service');
          return;
        }
        
        const email = emailInput?.value || '';
        
        // Validate email
        if (!email || !email.includes('@')) {
          alert('Please enter a valid email address');
          emailInput?.focus();
          return;
        }
        
        // Disable button while loading
        this.disabled = true;
        this.textContent = 'Loading...';
        
        try {
          await openPaddleCheckout(containerId, email);
        } finally {
          this.disabled = false;
          this.textContent = 'Start 3-Day Free Trial';
        }
      });
    });
  }
  
  // Initialize Paddle on page load
  if (typeof Paddle !== 'undefined') {
    initPaddle();
    initPaddleCheckoutButtons();
  } else {
    // Wait for Paddle.js to load
    window.addEventListener('load', function() {
      if (typeof Paddle !== 'undefined') {
        initPaddle();
        initPaddleCheckoutButtons();
      }
    });
  }

  // Инициализация Stripe Elements после загрузки страницы
  function initStripeElements() {
    if (typeof Stripe === 'undefined') {
      console.error('Stripe.js is not loaded');
      return;
    }

    try {
      stripe = Stripe('pk_test_51SaDJJF7QsJpghDdIRUvX9fpLJ2iAjEoCfPMjbArUpHTyRgPyhyBq7ba7YrNHPpc1Oc14w7d6egLidAOfokbneFK00KccSsXbq');
    } catch (e) {
      console.error('Stripe init error:', e);
      return;
    }

    if (!stripe) {
      console.error('Failed to initialize Stripe');
      return;
    }

    const cardElementContainer1 = document.getElementById('card-element-1');
    const cardElementContainer2 = document.getElementById('card-element-2');

    if (!cardElementContainer1 && !cardElementContainer2) {
      return; // Нет контейнеров для карт на этой странице
    }

    // Стили для Stripe Elements, чтобы они выглядели как обычные поля формы
    const elementStyles = {
      base: {
        fontSize: '16px',
        color: '#0A163E',
        fontFamily: 'inherit',
        '::placeholder': {
          color: '#999',
        },
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a',
      },
    };

    stripeElements = stripe.elements();

    if (cardElementContainer1) {
      try {
        cardElement1 = stripeElements.create('card', {
          style: elementStyles,
        });
        cardElement1.mount('#card-element-1');
        
        // Обработка ошибок валидации карты
        cardElement1.on('change', function(event) {
          const errorElement = document.getElementById('card-errors-1');
          if (event.error) {
            if (errorElement) {
              errorElement.textContent = event.error.message;
            }
          } else {
            if (errorElement) {
              errorElement.textContent = '';
            }
          }
        });
      } catch (e) {
        console.error('Failed to mount card element 1:', e);
      }
    }

    if (cardElementContainer2) {
      try {
        cardElement2 = stripeElements.create('card', {
          style: elementStyles,
        });
        cardElement2.mount('#card-element-2');
        
        // Обработка ошибок валидации карты
        cardElement2.on('change', function(event) {
          const errorElement = document.getElementById('card-errors-2');
          if (event.error) {
            if (errorElement) {
              errorElement.textContent = event.error.message;
            }
          } else {
            if (errorElement) {
              errorElement.textContent = '';
            }
          }
        });
      } catch (e) {
        console.error('Failed to mount card element 2:', e);
      }
    }

    // Apple Pay / Google Pay - Payment Request API
    initApplePay();
  }

  // Инициализация Apple Pay / Google Pay
  function initApplePay() {
    console.log('initApplePay called');
    
    // Находим ВСЕ кнопки Apple Pay (может быть несколько форм)
    const applePayButtons = document.querySelectorAll('.applepay-btn');
    const startFreeBtn = document.getElementById('payment-request-button');
    
    console.log(`Found ${applePayButtons.length} Apple Pay button(s)`);
    
    if (!stripe) {
      console.warn('Stripe not initialized');
      // Если Stripe не загружен, добавляем fallback для кнопки "Start for Free"
      if (startFreeBtn) {
        startFreeBtn.addEventListener('click', function() {
          // Прокручиваем к форме оплаты
          const paymentForm = document.querySelector('.payment-info');
          if (paymentForm) {
            paymentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
      return;
    }

    // Создаём Payment Request для подписки
    // Показываем начальную сумму $0 (trial), затем $29.99/month
    paymentRequest = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: {
        label: 'Ultra Cleaner - 3 Day Trial',
        amount: 0, // $0 для trial периода
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Общая функция для обработки клика на кнопки Apple Pay / Google Pay
    async function handlePaymentButtonClick(e) {
      console.log('handlePaymentButtonClick called', e);
      
      // Получаем кнопку, на которую кликнули
      const clickedButton = e?.currentTarget || e?.target || this;
      console.log('Clicked button:', clickedButton, 'disabled:', clickedButton.disabled);
      
      // Проверяем, не disabled ли кнопка
      if (clickedButton.disabled) {
        console.log('Button is disabled - checking why...');
        // Если кнопка disabled, всё равно пытаемся продолжить (может быть из-за чекбокса)
        // Но сначала проверим чекбокс
      }
      
      // Проверяем согласие с условиями (ищем ближайший чекбокс в той же форме)
      const paymentInfo = clickedButton.closest('.payment-info');
      console.log('Payment info container:', paymentInfo);
      
      const form = paymentInfo?.querySelector('form');
      console.log('Form found:', form);
      
      // Ищем чекбокс в форме или в ближайшем контейнере
      let agreementCheckbox = null;
      if (form) {
        agreementCheckbox = form.querySelector('.js-agreements');
      }
      if (!agreementCheckbox && paymentInfo) {
        agreementCheckbox = paymentInfo.querySelector('.js-agreements');
      }
      if (!agreementCheckbox) {
        agreementCheckbox = document.querySelector('.js-agreements');
      }
      
      console.log('Agreement checkbox:', agreementCheckbox, 'checked:', agreementCheckbox?.checked);
        
      if (agreementCheckbox && !agreementCheckbox.checked) {
        alert('Please agree to the Terms of Service');
        return;
      }
      
      // Если кнопка disabled, но чекбокс checked, временно включаем кнопку
      if (clickedButton.disabled && agreementCheckbox && agreementCheckbox.checked) {
        console.log('Button was disabled but agreement is checked, enabling temporarily');
        clickedButton.disabled = false;
      }

      // Проверяем доступность Apple Pay / Google Pay при каждом клике
      if (!paymentRequest) {
        console.log('PaymentRequest not available, scrolling to form');
        // Fallback: прокручиваем к форме оплаты картой
        if (paymentInfo) {
          paymentInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      const canMakePayment = await paymentRequest.canMakePayment();
      console.log('canMakePayment:', canMakePayment);
      
      if (canMakePayment) {
        try {
          // Показываем Apple Pay / Google Pay sheet
          console.log('Showing payment request');
          const paymentResponse = await paymentRequest.show();
          await handleApplePayPayment(paymentResponse);
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Payment Request error:', err);
            // Fallback: прокручиваем к форме оплаты картой
            if (paymentInfo) {
              paymentInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          } else {
            console.log('Payment request aborted by user');
          }
        }
      } else {
        // Apple Pay / Google Pay недоступен - прокручиваем к форме оплаты картой
        console.log('Apple Pay not available, scrolling to form');
        if (paymentInfo) {
          paymentInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    // ВСЕГДА добавляем обработчики на все кнопки Apple Pay (независимо от доступности)
    applePayButtons.forEach(function(btn, index) {
      console.log(`Setting up Apple Pay button ${index + 1}:`, btn.id || `button-${index}`, btn);
      
      // Добавляем обработчик клика (используем capture phase для приоритета)
      btn.addEventListener('click', function(e) {
        console.log(`Apple Pay button ${index + 1} clicked`, e);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handlePaymentButtonClick(e);
      }, true); // Используем capture phase
      
      // Проверяем доступность Apple Pay / Google Pay для показа/скрытия кнопки
      if (paymentRequest) {
        paymentRequest.canMakePayment().then(function(result) {
          if (result) {
            console.log(`Apple Pay available for button ${index + 1}`);
            btn.style.display = 'block';
          } else {
            console.log(`Apple Pay not available for button ${index + 1}`);
            btn.style.display = 'none';
          }
        }).catch(function(err) {
          console.error(`Error checking payment availability for button ${index + 1}:`, err);
          btn.style.display = 'none';
        });
      } else {
        btn.style.display = 'none';
      }
    });
    
    console.log(`Initialized ${applePayButtons.length} Apple Pay button(s)`);

    // Всегда добавляем обработчик на кнопку "Start for Free"
    if (startFreeBtn) {
      startFreeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Start for Free button clicked');
        handlePaymentButtonClick.call(this);
      });
      console.log('Start for Free button handler attached');
    } else {
      console.warn('Start for Free button (#payment-request-button) not found');
    }

    // Обработчик события paymentmethod от Payment Request API
    paymentRequest.on('paymentmethod', async function(ev) {
      await handleApplePayPayment(ev);
    });
  }

  // Обработка платежа через Apple Pay / Google Pay
  async function handleApplePayPayment(paymentEvent) {
    const payerEmail = paymentEvent.payerEmail;
    const paymentMethod = paymentEvent.paymentMethod;

    try {
      // Шаг 1: Создаём клиента и SetupIntent на бэкенде
      const setupResponse = await fetch(`${API_BASE_URL}/api/stripe/create-setup-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payerEmail }),
      });

      if (!setupResponse.ok) {
        throw new Error('Failed to create setup intent');
      }

      const setupData = await setupResponse.json();
      const { customerId, priceId } = setupData;

      // Шаг 2: Создаём подписку с полученным payment method
      const subscriptionResponse = await fetch(`${API_BASE_URL}/api/stripe/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          price_id: priceId,
          payment_method_id: paymentMethod.id,
        }),
      });

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json();
        throw new Error(errorData.detail || 'Failed to create subscription');
      }

      const subscriptionData = await subscriptionResponse.json();

      // Успех - завершаем Payment Request
      paymentEvent.complete('success');

      // Показываем успех и редиректим
      console.log('Subscription created via Apple Pay:', subscriptionData);
      setTimeout(() => {
        redirect('welcome.html');
      }, 500);

    } catch (error) {
      console.error('Apple Pay payment error:', error);
      paymentEvent.complete('fail');

      // Показываем модалку с ошибкой
      const declineModal = document.getElementById('modal-decline');
      if (declineModal && typeof modal !== 'undefined') {
        modal.open('#modal-decline');
      }
    }
  }

  // Инициализируем Stripe Elements после загрузки страницы
  // Проверяем несколько раз, так как Stripe.js может загружаться асинхронно
  let initAttempts = 0;
  const maxAttempts = 10;
  
  function tryInitStripeElements() {
    initAttempts++;
    
    if (typeof Stripe !== 'undefined') {
      initStripeElements();
    } else if (initAttempts < maxAttempts) {
      setTimeout(tryInitStripeElements, 100);
    } else {
      console.error('Stripe.js failed to load after', maxAttempts, 'attempts');
    }
  }
  
  tryInitStripeElements();

  async function createStripeSetupIntent(email) {
    const response = await fetch(`${API_BASE_URL}/api/stripe/create-setup-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create setup intent: ${text}`);
    }

    const data = await response.json();

    if (!data.clientSecret) {
      throw new Error('Stripe clientSecret is missing in response');
    }

    return data; // Возвращаем весь объект с clientSecret, customerId, priceId
  }

  async function createSubscriptionWithPaymentMethod(customerId, priceId, paymentMethodId) {
    const response = await fetch(`${API_BASE_URL}/api/stripe/create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        price_id: priceId,
        payment_method_id: paymentMethodId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create subscription: ${text}`);
    }

    return await response.json();
  }

  async function handleInlineStripeSubscription(form) {
    if (!stripe || !stripeElements) {
      console.error('Stripe is not initialized or Elements not available');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const emailInput = form.querySelector('input[type="email"]');
    const errorContainer = form.id === 'form-payment-1'
      ? document.getElementById('card-errors-1')
      : document.getElementById('card-errors-2');

    const email = emailInput ? emailInput.value : '';
    const cardElement = form.id === 'form-payment-1' ? cardElement1 : cardElement2;

    if (!cardElement) {
      console.error('Stripe card element not found for form', form.id);
      return;
    }

    if (errorContainer) {
      errorContainer.textContent = '';
    }

    if (submitButton) {
      disabledBtn(submitButton);
    }

    try {
      // Шаг 1: Создаём SetupIntent для сохранения карты
      const setupData = await createStripeSetupIntent(email);
      const { clientSecret, customerId, priceId } = setupData;

      // Проверяем, что clientSecret действительно от SetupIntent (начинается с seti_)
      if (!clientSecret) {
        throw new Error('SetupIntent client secret is missing');
      }
      
      if (!clientSecret.startsWith('seti_')) {
        console.error('Invalid client secret type:', clientSecret.substring(0, 10));
        throw new Error('Invalid SetupIntent client secret received. Expected SetupIntent secret starting with "seti_"');
      }

      // Шаг 2: Подтверждаем карту через SetupIntent (НЕ PaymentIntent!)
      // ВАЖНО: используем confirmCardSetup для SetupIntent, НЕ confirmCardPayment!
      // Проверяем еще раз перед вызовом
      if (!clientSecret.startsWith('seti_')) {
        throw new Error('CRITICAL: Attempting to use SetupIntent secret with wrong method. Secret type: ' + clientSecret.substring(0, 10));
      }
      
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: email || undefined,
          },
        },
      });

      if (error) {
        console.error('Stripe setup error:', error);
        if (errorContainer) {
          errorContainer.textContent = error.message || 'Card verification failed. Please try again.';
        }
        // Показать модалку об ошибке, если она есть
        const declineModal = document.getElementById('modal-decline');
        if (declineModal && typeof modal !== 'undefined') {
          modal.open('#modal-decline');
        }
        return;
      }

      if (setupIntent && setupIntent.status === 'succeeded') {
        // Шаг 3: Создаём подписку с сохраненным PaymentMethod
        // payment_method может быть строкой (ID) или объектом
        const paymentMethodId = typeof setupIntent.payment_method === 'string' 
          ? setupIntent.payment_method 
          : setupIntent.payment_method?.id || setupIntent.payment_method;
        
        if (!paymentMethodId) {
          throw new Error('Payment method ID not found in setup intent');
        }
        
        try {
          const subscriptionResult = await createSubscriptionWithPaymentMethod(
            customerId,
            priceId,
            paymentMethodId
          );

          // Успех создания подписки
          form.classList.add('is-success');
          setTimeout(() => {
            form.reset();
            form.classList.remove('is-success');
            // после успешной оплаты можно редиректить в личный кабинет / welcome
            redirect('welcome.html');
          }, 1000);
        } catch (subError) {
          console.error('Subscription creation error:', subError);
          if (errorContainer) {
            errorContainer.textContent = subError.message || 'Failed to create subscription. Please try again.';
          }
        }
      }
    } catch (e) {
      console.error('Subscription error:', e);
      if (errorContainer) {
        errorContainer.textContent = e.message || 'Payment failed. Please try again.';
      }
    } finally {
      if (submitButton) {
        enabledBtn(submitButton);
      }
    }
  }

  /* form */

  const maskList = {
    'code': '0000',
    'card-number': '0000 0000 0000 0000',
    'card-cvc': '000',
    'card-date': 'MM/YY',
  };

  const paymentsForms = document.querySelectorAll('.js-form');

  paymentsForms.forEach(form => {
    let inputs = form.querySelectorAll('input, textarea');
    let sendButton = form.querySelector('button[type="submit"]');

    let inputsArray = Array.from(inputs).map(input => {
      const { id, name, validity: { valid } } = input;
      return { id, name, valid };
    });

    for (let input of inputs) {
      let isValid = true;
      let iMaskInstance = null;

      if (input.dataset.mask) {
        const mask = maskList[input.dataset.mask];

        iMaskInstance = IMask(input, {
          mask: mask,
          blocks: {
            YY: {
              mask: '00',
            },
            MM: {
              mask: IMask.MaskedRange,
              from: 1,
              to: 12,
            },
          },
        });
      }

      input.addEventListener('input', function () {
        isValid = this.validity.valid;

        if (iMaskInstance) {
          isValid = iMaskInstance.masked.isComplete;
        }

        inputsArray = inputsArray.map(el => {
          if (el.id === input.id) {
            return {
              ...el,
              valid: isValid
            };
          }
          return el;
        });

        input.classList.toggle('is-error', !isValid);
        checkValidForm();
      });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (checkValidForm()) {
        // Для платежных форм используем Stripe Elements на этой же странице
        if (form.id === 'form-payment-1' || form.id === 'form-payment-2') {
          handleInlineStripeSubscription(form);
        } else {
          handleFormSubmit(
            form,
            'mail/send.php',
            (form) => {
              // if success
              form.classList.add('is-success');
              setTimeout(() => {
                form.reset();
                form.classList.remove('is-success');
                if (typeof modal !== 'undefined' && typeof modal.close === 'function') {
                  modal.close();
                }
              }, 2000);
            },
            (error, form) => {
              // if error
              console.error('Ошибка отправки формы:', error);
              form.classList.add('is-error');
              setTimeout(() => {
                form.classList.remove('is-error');
              }, 3000);
            }
          );
        }
      }
    });

    function checkValidForm() {
      let isValid = !inputsArray.some(el => !el.valid);

      form.classList.toggle('has-error', !isValid);
      sendButton.disabled = !isValid;
      return isValid;
    }
  });

  /* menu */

  const menu = document.querySelector('.js-menu');

  if (menu) {
    const menuToggle = document.querySelector('.js-menu-toggle');
    const menuCloseBtn = document.querySelector('.js-menu-close');
    let isAnimation = false;

    menuToggle.addEventListener('click', function () {
      if (isAnimation) return;

      if (this.classList.contains('is-active')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    menuCloseBtn.addEventListener('click', function () {
      if (isAnimation) return;

      closeMenu();
    });

    function closeMenu() {
      isAnimation = true;

      document.body.classList.remove('no-scroll');
      menuToggle.setAttribute('aria-expanded', false);
      menuToggle.classList.remove('is-active');
      menu.classList.remove('is-active');

      menu.addEventListener('transitionend', function () {
        menu.classList.add('is-closed');
        isAnimation = false;
      }, {
        once: true,
      });

      document.removeEventListener('keyup', pressEsc);
    }

    function openMenu() {
      isAnimation = true;

      document.body.classList.add('no-scroll');
      menuToggle.setAttribute('aria-expanded', true);
      menuToggle.classList.add('is-active');
      menu.classList.remove('is-closed');

      setTimeout(() => {
        menu.classList.add('is-active');
        isAnimation = false;
      }, 20);

      document.addEventListener('keyup', pressEsc);
    }

    function pressEsc(e) {
      if (e.key === 'Escape') {
        closeMenu();
      }
    }
  }

  /* previews slider */

  const previewsSlider = new Swiper('.previews-slider', {
    initialSlide: 1,
    slidesPerView: 1,
    spaceBetween: 0,
    centeredSlides: true,
    loop: true,
    autoplay: {
      delay: 5000,
    },
    speed: 700,
    pagination: {
      el: '.previews-slider .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.previews-slider .swiper-button-next',
      prevEl: '.previews-slider .swiper-button-prev',
    },
    breakpoints: {
      998: {
        slidesPerView: "auto",
        spaceBetween: 20,
      },
    },
  });

  /* quiz slider */

  const quizSlider = new Swiper('.quiz-slider', {
    slidesPerView: 1,
    spaceBetween: 20,
    centeredSlides: true,
    speed: 700,
    pagination: {
      el: '.quiz-slider .swiper-pagination',
      clickable: true,
    },
  });

  /* gallery slider */

  const gallerySlider = new Swiper('.gallery-slider', {
    slidesPerView: "auto",
    spaceBetween: 8,
    loop: true,
    autoplay: {
      delay: 3000,
    },
    speed: 700,
  });

  /* features slider */

  const featuresSlider = new Swiper('.features-slider', {
    slidesPerView: 1,
    spaceBetween: 20,
    centeredSlides: true,
    loop: true,
    autoplay: {
      delay: 3000,
    },
    speed: 700,
    pagination: {
      el: '.features-slider .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.features-slider .swiper-button-next',
      prevEl: '.features-slider .swiper-button-prev',
    },
  });

  /* reviews slider */

  const reviewsSlider = new Swiper('.reviews-slider', {
    slidesPerView: 1.25,
    spaceBetween: 16,
    loop: true,
    autoplay: {
      delay: 5000,
    },
    speed: 700,
    pagination: {
      el: '.reviews-slider .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.reviews-slider .swiper-button-next',
      prevEl: '.reviews-slider .swiper-button-prev',
    },
    breakpoints: {
      576: {
        slidesPerView: 2.25,
      },
      998: {
        slidesPerView: 3,
        spaceBetween: 44,
      },
    },
  });

  /* lk reviews slider */

  const lkReviewsSlider = new Swiper('.reviews-slider-2', {
    slidesPerView: 1.25,
    spaceBetween: 16,
    loop: true,
    autoplay: {
      delay: 5000,
    },
    speed: 700,
    breakpoints: {
      576: {
        slidesPerView: 2.25,
      },
      998: {
        slidesPerView: 3.5,
        spaceBetween: 44,
      },
    },
  });

  /* info cards slider */

  const infoCardsSlider = new Swiper('.info-cards-slider', {
    slidesPerView: 1.25,
    spaceBetween: 16,
    loop: true,
    autoplay: {
      delay: 5000,
    },
    speed: 700,
    pagination: {
      el: '.info-cards-slider .swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: '.info-cards-slider .swiper-button-next',
      prevEl: '.info-cards-slider .swiper-button-prev',
    },
    breakpoints: {
      576: {
        slidesPerView: 2.25,
      },
      998: {
        slidesPerView: 1,
      },
    },
  });

  /* timer */

  const timer = document.querySelector(".js-timer");

  if (timer) {
    const minutesEl = timer.querySelector(".js-timer-min");
    const secondsEl = timer.querySelector(".js-timer-sec");
    let totalSeconds = 10 * 60; // 10 minutes

    function updateTimer() {
      if (totalSeconds <= 0) {
        clearInterval(timerInterval);
        minutes.textContent = "00";
        seconds.textContent = "00";
        return;
      }

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      minutesEl.textContent = String(minutes).padStart(2, "0");
      secondsEl.textContent = String(seconds).padStart(2, "0");
      totalSeconds--;
    }

    const timerInterval = setInterval(updateTimer, 1000);

    updateTimer();
  }

  /* accordion */

  const accordionBlocks = document.querySelectorAll('.js-accordion');

  accordionBlocks?.forEach(accordion => {
    const items = accordion.querySelectorAll('.js-accordion-item');

    items.forEach(item => {
      const toggle = item.querySelector('.js-accordion-toggle');

      toggle.addEventListener('click', () => {
        // close other item
        const lastItem = accordion.querySelector('.js-accordion-item.is-active');

        if (lastItem && lastItem != item) {
          closeItem(lastItem);
        }
        // close this item
        if (item.classList.contains('is-active')) {
          closeItem(item);
          return;
        }
        // open this item
        openItem(item);
      });

      function openItem(item) {
        item.classList.add('is-active');
        item.querySelector('.js-accordion-toggle').setAttribute('aria-expanded', true);
      }

      function closeItem(item) {
        item.classList.remove('is-active');
        item.querySelector('.js-accordion-toggle').setAttribute('aria-expanded', false);
      }
    });
  });

  /*  modal */

  const modal = new HystModal({
    linkAttributeName: 'data-hystmodal',
    catchFocus: true,
    waitTransitions: true,
    closeOnEsc: true,
    backscroll: true,
    beforeOpen: function (modal) {
      const id = modal.element.id;

      if (id) {
        const currentUrl = window.location.href.split('#')[0];
        window.history.pushState(null, '', `${currentUrl}#${id}`);
      }
    },
    afterClose: function (modal) {
      const id = modal.element.id;

      if (id) {
        const currentUrl = window.location.href.split('#')[0];
        window.history.replaceState(null, '', currentUrl);
      }
    },
  });

  const hash = window.location.hash;

  if (hash && hash.startsWith('#')) {
    const modalId = hash.substring(1);
    const modalElement = document.getElementById(modalId);

    if (modalElement) {
      modal.open(`#${modalId}`);
    }
  }

  /* startCircleProgress */

  function startCircleProgress(el, duration = 7000) {
    const circle = el.querySelector('.circle-progress__circle');
    const text = el.querySelector('.circle-progress__text');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;

    let startTime = null;

    function animateCircle(timestamp) {
      if (!startTime) startTime = timestamp;

      const progress = timestamp - startTime;
      const percent = Math.min((progress / duration) * 100, 100);
      const offset = circumference - (percent / 100) *
        circumference;

      circle.style.strokeDashoffset = offset;
      text.textContent = `${Math.round(percent)}%`;

      if (progress < duration) {
        requestAnimationFrame(animateCircle);
      }
    }

    requestAnimationFrame(animateCircle);
  }

  /* quiz */

  const quiz = document.querySelector('.js-quiz');

  if (quiz) {
    const form = quiz.querySelector('form');
    const formProgress = quiz.querySelector('.js-quiz-form-progress');
    const steps = quiz.querySelectorAll('.js-quiz-step');
    const nextBtns = quiz.querySelectorAll('.js-quiz-next');
    const prevBtns = quiz.querySelectorAll('.js-quiz-prev');
    const progress = quiz.querySelector('.js-quiz-progress');
    let currentStepNum = 1;

    validationStep(steps[currentStepNum - 1]);

    updateProgress();

    steps[currentStepNum - 1].classList.add('is-active');

    nextBtns.forEach(btn => btn.addEventListener('click', nextStep));

    prevBtns.forEach(btn => btn.addEventListener('click', prevStep));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      /* test */
      // nextStep();
      // startCircleProgress(formProgress);
      // setTimeout(() => {
      //   nextStep();
      // }, 7000);

      handleFormSubmit(
        form,
        'mail/send.php',
        (form) => {
          nextStep();
          startCircleProgress(formProgress);
          setTimeout(() => {
            nextStep();
          }, 7000);
        },
        (error, form) => {
          console.error('Ошибка отправки формы:', error);
        }
      );
    });

    function nextStep() {
      if (currentStepNum < steps.length) {
        if (validationStep(steps[currentStepNum - 1])) {
          changeStep(currentStepNum + 1);
        }
      }
    }

    function prevStep() {
      if (currentStepNum > 1) {
        changeStep(currentStepNum - 1);
      }
    }

    function changeStep(nextStepNum) {
      let currentStep = steps[currentStepNum - 1];

      const keyframesOut = [{
        opacity: 1,
        transform: 'scale(1)',
      },
      {
        opacity: 0,
        transform: 'scale(0.99)',
      },
      ];

      const keyframesIn = [{
        opacity: 0,
      },
      {
        opacity: 1,
      },
      ];

      const options = {
        duration: 500,
      };

      let lastStepAnim = currentStep.animate(keyframesOut, options);

      lastStepAnim.addEventListener('finish', function () {
        currentStep.classList.remove('is-active');
        currentStepNum = nextStepNum;
        currentStep = steps[currentStepNum - 1];
        currentStep.animate(keyframesIn, options);
        currentStep.classList.add('is-active');

        validationStep(currentStep)

        updateProgress();

        if (currentStep.classList.contains('quiz-step--no-nav')) {
          quiz.classList.add('hide-nav');
        } else {
          quiz.classList.remove('hide-nav');
        }

        if (currentStep.classList.contains('quiz-step--bg')) {
          quiz.classList.add('has-bg');
        } else {
          quiz.classList.remove('has-bg');
        }

        if (currentStep.classList.contains('quiz-step--result')) {
          quizSlider.autoplay.start();
        }
      });
    }

    function validationStep(step) {
      let isValid = true;
      let inputs = step.querySelectorAll('input, select, textarea');
      let radioInputs = step.querySelectorAll('input[type="radio"]');
      let checkboxInputs = step.querySelectorAll('input[type="checkbox"]');
      let nextButton = step.querySelector('.quiz-step__actions .js-quiz-next');
      let sendButton = step.querySelector('button[type="submit"]');

      if (radioInputs.length > 0) {
        let isRadioSelected = Array.from(radioInputs).some(radio => radio.checked);

        if (!isRadioSelected) {
          isValid = false;

          if (nextButton) {
            disabledBtn(nextButton);
          }

          if (sendButton) {
            disabledBtn(sendButton);
          }
        }
      }

      if (checkboxInputs.length > 0) {
        let isCheckboxSelected = Array.from(checkboxInputs).some(radio => radio.checked);

        if (!isCheckboxSelected) {
          isValid = false;

          if (nextButton) {
            disabledBtn(nextButton);
          }

          if (sendButton) {
            disabledBtn(sendButton);
          }
        }
      }

      if (inputs.length > 0) {
        for (let input of inputs) {
          let rule = input.dataset.rule;

          if (!input.validity.valid) {
            if (nextButton) {
              disabledBtn(nextButton);
            }

            if (sendButton) {
              disabledBtn(sendButton);
            }

            input.classList.add('is-invalid');
            isValid = false;
          } else {
            input.classList.remove('is-invalid');
          }

          input.addEventListener('input', function () {
            if (rule) {
              this.value = this.value.replace(regExps[rule], '');
            }
            if (!input.validity.valid) {
              input.classList.add('is-invalid');

              if (nextButton) {
                disabledBtn(nextButton);
              }

              if (sendButton) {
                disabledBtn(sendButton);
              }
            } else {
              if (nextButton) {
                enabledBtn(nextButton);
              }

              if (sendButton) {
                enabledBtn(sendButton);
              }

              input.classList.remove('is-invalid');
            }

            validationStep(step)
          });
        }
      }

      return isValid;
    }

    function updateProgress() {
      progress.querySelector('.progress__line').style.width = currentStepNum * 100 / (steps.length - 3) + '%';
    }
  }

  /* show hidden block on scroll */

  let hiddenBlock = document.querySelector('.js-show-on-scroll');

  if (hiddenBlock) {
    window.addEventListener('scroll', showRules);
  }

  function showRules() {
    hiddenBlock.classList.add('is-visible');
    window.removeEventListener('scroll', showRules);
  }

  /* setCurrentYear */

  let yearItems = document.querySelectorAll('.js-current-year');

  if (yearItems.length > 0) {
    const today = new Date();

    yearItems.forEach(item => {
      item.innerText = today.getFullYear();
    });
  }

  /* animation */

  lottie.loadAnimation({
    container: document.getElementById('offer-info-anim'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: '../images/peiwall.json',
  });
});
