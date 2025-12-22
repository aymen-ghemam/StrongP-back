import { Types } from "mongoose";
import Product from "../models/products.js";
import Category from "../models/category.js";
import { successResponse, errorResponse } from "../utils/responseFormatter.js";
import { StatusCodes } from "http-status-codes";

export async function getProducts(req, res) {
  try {
    const {
      category,
      q,
      sortBy = "createdAt",
      sortOrder = -1,
      limit = 10,
      page = 1,
    } = req.query;

    console.log("category", category);

    // Build filter
    const filter = {};

    // Search by name or description
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    // Filter by category (handle both ObjectId and category name)
    if (category) {
      // Check if it's a valid ObjectId
      if (Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        // Otherwise, treat it as a category name and look it up
        const categoryDoc = await Category.findOne({ name: category });
        if (!categoryDoc) {
          return errorResponse(
            res,
            null,
            "Category not found",
            StatusCodes.NOT_FOUND,
          );
        }
        filter.category = categoryDoc._id;
      }
    }

    // Filter by status
    filter.status = "active";

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(filter)
      .populate("category")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ [sortBy]: parseInt(sortOrder) });

    const total = await Product.countDocuments(filter);

    return successResponse(
      res,
      {
        products,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
      "Products fetched successfully",
    );
  } catch (error) {
    console.error("Error fetching products:", error);
    return errorResponse(
      res,
      error,
      "Failed to fetch products",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(
        res,
        null,
        "Invalid product ID",
        StatusCodes.BAD_REQUEST,
      );
    }

    const product = await Product.findById(id).populate("category");

    if (!product) {
      return errorResponse(
        res,
        null,
        "Product not found",
        StatusCodes.NOT_FOUND,
      );
    }

    return successResponse(res, product, "Product fetched successfully");
  } catch (error) {
    console.error("Error fetching product:", error);
    return errorResponse(
      res,
      error,
      "Failed to fetch product",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function createProduct(req, res) {
  try {
    const { name, description, price, category, images, stock } = req.body;

    // Validation
    if (!name || !description || !price || !category) {
      return errorResponse(
        res,
        null,
        "Missing required fields",
        StatusCodes.BAD_REQUEST,
      );
    }

    // Validate category ObjectId
    if (!Types.ObjectId.isValid(category)) {
      return errorResponse(
        res,
        null,
        "Invalid category ID",
        StatusCodes.BAD_REQUEST,
      );
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      images: images || [],
      stock: stock || 0,
      status: "active",
      createdBy: req.user?._id,
    });

    await product.save();
    await product.populate("category");

    return successResponse(
      res,
      product,
      "Product created successfully",
      StatusCodes.CREATED,
    );
  } catch (error) {
    console.error("Error creating product:", error);
    return errorResponse(
      res,
      error,
      "Failed to create product",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { name, description, price, category, images, stock, status } =
      req.body;

    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(
        res,
        null,
        "Invalid product ID",
        StatusCodes.BAD_REQUEST,
      );
    }

    const product = await Product.findById(id);

    if (!product) {
      return errorResponse(
        res,
        null,
        "Product not found",
        StatusCodes.NOT_FOUND,
      );
    }

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) {
      if (!Types.ObjectId.isValid(category)) {
        return errorResponse(
          res,
          null,
          "Invalid category ID",
          StatusCodes.BAD_REQUEST,
        );
      }
      product.category = category;
    }
    if (images) product.images = images;
    if (stock !== undefined) product.stock = stock;
    if (status) product.status = status;

    await product.save();
    await product.populate("category");

    return successResponse(res, product, "Product updated successfully");
  } catch (error) {
    console.error("Error updating product:", error);
    return errorResponse(
      res,
      error,
      "Failed to update product",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return errorResponse(
        res,
        null,
        "Invalid product ID",
        StatusCodes.BAD_REQUEST,
      );
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return errorResponse(
        res,
        null,
        "Product not found",
        StatusCodes.NOT_FOUND,
      );
    }

    return successResponse(res, null, "Product deleted successfully");
  } catch (error) {
    console.error("Error deleting product:", error);
    return errorResponse(
      res,
      error,
      "Failed to delete product",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}
