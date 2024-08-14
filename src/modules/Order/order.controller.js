//================================= add   order  ====================================
import { nanoid } from 'nanoid';

import { couponValidation } from '../../utils/coupon-validation.js';
import { checkProductAvailability } from '../Cart/utils/check-product-in-db.js';
import Order from '../../../DB/Models/order.model.js';
import CouponUsers from '../../../DB/Models/coupon-users.model.js';
import { getUserCart } from '../Cart/utils/get-user-cart.js';
import Product from '../../../DB/Models/product.model.js';
import Cart from '../../../DB/Models/cart.model.js';
import { DateTime } from 'luxon';
import { qrCodeGeneration } from '../../utils/qr-code.js';
import {
  confirmPaymentIntent,
  createCheckoutSession,
  createPaymentIntent,
  createStripeCoupon,
  refundPaymentIntent,
  retrievePaymentIntent,
} from '../../payment-handler/stripe.js';
import createInvoice from '../../utils/pdfKit.js';
import sendEmailService from '../../services/send-email.service.js';

export const createOrder = async (req, res, next) => {
  //destructure the request body
  const {
    product, // product id
    quantity,
    couponCode,
    paymentMethod,
    phoneNumbers,
    address,
    city,
    postalCode,
    country,
  } = req.body;

  const { _id: user } = req.authUser;

  // coupon code check
  let coupon = null;
  if (couponCode) {
    const isCouponValid = await couponValidation(couponCode, user);
    if (isCouponValid.status)
      return next({
        message: isCouponValid.message,
        cause: isCouponValid.status,
      });
    coupon = isCouponValid;
  }

  // product check
  const isProductAvailable = await checkProductAvailability(product, quantity);
  if (!isProductAvailable)
    return next({ message: 'Product is not available', cause: 400 });

  let orderItems = [
    {
      title: isProductAvailable.title,
      quantity,
      price: isProductAvailable.appliedPrice,
      product: isProductAvailable._id,
    },
  ];

  //prices
  let shippingPrice = orderItems[0].price * quantity;
  let totalPrice = shippingPrice;

  console.log(shippingPrice, totalPrice);
  console.log(!(coupon?.couponAmount <= shippingPrice));

  if (coupon?.isFixed && !(coupon?.couponAmount <= shippingPrice))
    return next({ message: 'You cannot use this coupon', cause: 400 });

  if (coupon?.isFixed) {
    totalPrice = shippingPrice - coupon.couponAmount;
  } else if (coupon?.isPercentage) {
    totalPrice = shippingPrice - (shippingPrice * coupon.couponAmount) / 100;
  }

  // order status + payment method
  let orderStatus;
  if (paymentMethod === 'Cash') orderStatus = 'Placed';

  // create order
  const order = new Order({
    user,
    orderItems,
    shippingAddress: { address, city, postalCode, country },
    phoneNumbers,
    shippingPrice,
    coupon: coupon?._id,
    totalPrice,
    paymentMethod,
    orderStatus,
  });

  await order.save();

  isProductAvailable.stock -= quantity;
  await isProductAvailable.save();

  if (coupon) {
    await CouponUsers.updateOne(
      { couponId: coupon._id, userId: user },
      { $inc: { usageCount: 1 } }
    );
  }

  // generate QR code
  const orderQR = await qrCodeGeneration([
    {
      orderId: order._id,
      user: order.user,
      totalPrice: order.totalPrice,
      orderStatus: order.orderStatus,
    },
  ]);
  //=================== invoice =================
  const orderCode = `${req.authUser.userName}_${nanoid(3)}`;
  //generate invoice object
  const orderInvoice = {
    shipping: {
      name: req.authUser.userName,
      address: order.address,
      city: 'Alex',
      state: 'Alexander',
      country: 'EGY',
    },
    orderCode,
    date: order.createdAt,
    items: order.products,
    subTotal: order.subTotal,
    paidAmount: order.paidAmount,
  };
  await createInvoice(orderInvoice, `${orderCode}.pdf`);
  await sendEmailService({
    to: req.authUser.userName,
    subject: 'Order Confirmation',
    message: '<h1> Please find your invoice pdf below <h1>',
    attachments: [
      {
        path: `./Files/${orderCode}.pdf`,
      },
    ],
  });
  res
    .status(201)
    .json({ message: 'Order created successfully', order, orderQR });
};

//**************************************************************** */
export const convertFromcartToOrder = async (req, res, next) => {
  //destructure the request body
  const {
    couponCode,
    paymentMethod,
    phoneNumbers,
    address,
    city,
    postalCode,
    country,
  } = req.body;

  const { _id: user } = req.authUser;
  // cart items
  const userCart = await getUserCart(user);
  if (!userCart) return next({ message: 'Cart not found', cause: 404 });

  // coupon code check
  let coupon = null;
  if (couponCode) {
    const isCouponValid = await couponValidation(couponCode, user);
    if (isCouponValid.status)
      return next({
        message: isCouponValid.message,
        cause: isCouponValid.status,
      });
    coupon = isCouponValid;
  }

  // product check
  // const isProductAvailable = await checkProductAvailability(product, quantity);
  // if(!isProductAvailable) return next({message: 'Product is not available', cause: 400});

  let orderItems = userCart.products.map((cartItem) => {
    return {
      title: cartItem.title,
      quantity: cartItem.quantity,
      price: cartItem.basePrice,
      product: cartItem.productId,
    };
  });

  //prices
  let shippingPrice = userCart.subTotal;
  let totalPrice = shippingPrice;

  if (coupon?.isFixed && !(coupon?.couponAmount <= shippingPrice))
    return next({ message: 'You cannot use this coupon', cause: 400 });

  if (coupon?.isFixed) {
    totalPrice = shippingPrice - coupon.couponAmount;
  } else if (coupon?.isPercentage) {
    totalPrice = shippingPrice - (shippingPrice * coupon.couponAmount) / 100;
  }

  // order status + payment method
  let orderStatus;
  if (paymentMethod === 'Cash') orderStatus = 'Placed';

  // create order
  const order = new Order({
    user,
    orderItems,
    shippingAddress: { address, city, postalCode, country },
    phoneNumbers,
    shippingPrice,
    coupon: coupon?._id,
    totalPrice,
    paymentMethod,
    orderStatus,
  });

  await order.save();

  await Cart.findByIdAndDelete(userCart._id);

  for (const item of order.orderItems) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: -item.quantity } }
    );
  }

  if (coupon) {
    await CouponUsers.updateOne(
      { couponId: coupon._id, userId: user },
      { $inc: { usageCount: 1 } }
    );
  }

  res.status(201).json({ message: 'Order created successfully', order });
};

// ======================= order delivery =======================//
export const delieverOrder = async (req, res, next) => {
  const { orderId } = req.params;

  const updateOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      orderStatus: { $in: ['Paid', 'Placed'] },
    },
    {
      orderStatus: 'Delivered',
      deliveredAt: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
      deliveredBy: req.authUser._id,
      isDelivered: true,
    },
    {
      new: true,
    }
  );

  if (!updateOrder)
    return next({
      message: 'Order not found or cannot be delivered',
      cause: 404,
    });

  res
    .status(200)
    .json({ message: 'Order delivered successfully', order: updateOrder });
};

// ======================= order payment with stipe =======================//
export const payWithStripe = async (req, res, next) => {
  const { orderId } = req.params;
  const { _id: userId } = req.authUser;

  // get order details from our database
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
    orderStatus: 'Pending',
  });
  if (!order)
    return next({ message: 'Order not found or cannot be paid', cause: 404 });

  const paymentObject = {
    customer_email: req.authUser.email,
    metadata: { orderId: order._id.toString() },
    discounts: [],
    line_items: order.orderItems.map((item) => {
      return {
        price_data: {
          currency: 'EGP',
          product_data: {
            name: item.title,
          },
          unit_amount: item.price * 100, // in cents
        },
        quantity: item.quantity,
      };
    }),
  };
  // coupon check
  if (order.coupon) {
    const stripeCoupon = await createStripeCoupon({ couponId: order.coupon });
    if (stripeCoupon.status)
      return next({ message: stripeCoupon.message, cause: 400 });

    paymentObject.discounts.push({
      coupon: stripeCoupon.id,
    });
  }

  const checkoutSession = await createCheckoutSession(paymentObject);
  const paymentIntent = await createPaymentIntent({
    amount: order.totalPrice,
    currency: 'EGP',
  });

  order.payment_intent = paymentIntent.id;
  await order.save();

  res.status(200).json({ checkoutSession, paymentIntent });
};

//======== apply webhook locally to confirm the  order =================//
export const stripeWebhookLocal = async (req, res, next) => {
  const orderId = req.body.data.object.metadata.orderId;
  console.log(req.body.data.object.metadata.orderId);

  const confirmedOrder = await Order.findById(orderId);
  if (!confirmedOrder) return next({ message: 'Order not found', cause: 404 });

  await confirmPaymentIntent({
    paymentIntentId: confirmedOrder.payment_intent, //DB
  });

  confirmedOrder.isPaid = true;
  confirmedOrder.paidAt = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');
  confirmedOrder.orderStatus = 'Paid';

  await confirmedOrder.save();

  res.status(200).json({ message: 'webhook received' });
};

//*********************************************************** */
export const refundOrder = async (req, res, next) => {
  const { orderId } = req.params;

  const findOrder = await Order.findOne({ _id: orderId, orderStatus: 'Paid' });
  if (!findOrder)
    return next({
      message: 'Order not found or cannot be refunded',
      cause: 404,
    });

  // refund the payment intent
  const refund = await refundPaymentIntent({
    paymentIntentId: findOrder.payment_intent,
  });

  findOrder.orderStatus = 'Refunded';
  await findOrder.save();

  res
    .status(200)
    .json({ message: 'Order refunded successfully', order: refund });
};
