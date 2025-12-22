import { Types } from "mongoose";
import Order from "../models/orders.js";
import Product from "../models/products.js";
import { successResponse, errorResponse } from "../utils/responseFormatter.js";
import { StatusCodes } from "http-status-codes";

export async function createOrder(req, res) {
  try {
    const userId = req.user._id;
    const {
      items,
      shippingAddress,
      email,
      phone,
      paymentMethod,
      subtotal,
      tax,
      total,
      notes,
    } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return errorResponse(
        res,
        null,
        "Order must contain at least one item",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!shippingAddress) {
      return errorResponse(
        res,
        null,
        "Shipping address is required",
        StatusCodes.BAD_REQUEST,
      );
    }

    const { firstName, lastName, address, city, state, zipCode } =
      shippingAddress;

    if (!firstName || !lastName || !address || !city || !state || !zipCode) {
      return errorResponse(
        res,
        null,
        "All shipping address fields are required",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!email) {
      return errorResponse(
        res,
        null,
        "Email is required",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!phone) {
      return errorResponse(
        res,
        null,
        "Phone number is required",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!paymentMethod) {
      return errorResponse(
        res,
        null,
        "Payment method is required",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (subtotal === undefined || tax === undefined || total === undefined) {
      return errorResponse(
        res,
        null,
        "Subtotal, tax, and total are required",
        StatusCodes.BAD_REQUEST,
      );
    }

    // Validate all products exist and verify stock
    const orderItems = [];

    for (const item of items) {
      if (!item.productId) {
        return errorResponse(
          res,
          null,
          "Product ID is required for all items",
          StatusCodes.BAD_REQUEST,
        );
      }

      if (!Types.ObjectId.isValid(item.productId)) {
        return errorResponse(
          res,
          null,
          "Invalid product ID",
          StatusCodes.BAD_REQUEST,
        );
      }

      const product = await Product.findById(item.productId);

      if (!product) {
        return errorResponse(
          res,
          null,
          `Product ${item.productId} not found`,
          StatusCodes.NOT_FOUND,
        );
      }

      if (product.stock < item.quantity) {
        return errorResponse(
          res,
          null,
          `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
          StatusCodes.BAD_REQUEST,
        );
      }

      orderItems.push({
        productId: product._id,
        name: item.name || product.name,
        price: item.price || product.price,
        quantity: item.quantity,
        image: item.image || (product.images && product.images[0]) || "",
      });

      // Reduce stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Create order
    const order = new Order({
      user: userId,
      items: orderItems,
      shippingAddress: {
        firstName,
        lastName,
        address,
        city,
        state,
        zipCode,
      },
      email,
      phone,
      paymentMethod,
      subtotal,
      tax,
      total,
      notes: notes || "",
      status: "pending",
    });

    await order.save();
    await order.populate("items.productId", "name price images");

    return successResponse(
      res,
      order,
      "Order created successfully",
      StatusCodes.CREATED,
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return errorResponse(
      res,
      error,
      "Failed to create order",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getMyOrders(req, res) {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find({ user: userId })
      .populate("items.productId", "name price images")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments({ user: userId });

    return successResponse(
      res,
      {
        orders,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
      "Orders fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching orders:", error);
    return errorResponse(
      res,
      error,
      "Failed to fetch orders",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(
        res,
        null,
        "Invalid order ID",
        StatusCodes.BAD_REQUEST,
      );
    }

    const order = await Order.findById(id)
      .populate("items.productId", "name price images")
      .populate("user", "name email");

    if (!order) {
      return errorResponse(res, null, "Order not found", StatusCodes.NOT_FOUND);
    }

    // Check if order belongs to user
    if (order.user._id.toString() !== userId.toString()) {
      return errorResponse(res, null, "Unauthorized", StatusCodes.FORBIDDEN);
    }

    return successResponse(res, order, "Order fetched successfully");
  } catch (error) {
    console.error("Error fetching order:", error);
    return errorResponse(
      res,
      error,
      "Failed to fetch order",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(
        res,
        null,
        "Invalid order ID",
        StatusCodes.BAD_REQUEST,
      );
    }

    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (status && !validStatuses.includes(status)) {
      return errorResponse(
        res,
        null,
        `Status must be one of: ${validStatuses.join(", ")}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const order = await Order.findById(id);

    if (!order) {
      return errorResponse(res, null, "Order not found", StatusCodes.NOT_FOUND);
    }

    if (status) order.status = status;

    await order.save();
    await order.populate("items.productId", "name price images");

    return successResponse(res, order, "Order updated successfully");
  } catch (error) {
    console.error("Error updating order:", error);
    return errorResponse(
      res,
      error,
      "Failed to update order",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}
