const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const User = require("../../models/user.model");
const asyncMiddleware = require("../../middleware/async.middleware");
const Joi = require("joi");
const { registerLimiter } = require("../../middleware/rateLimiter.middleware");

const router = express.Router();

router.post(
  "/",
  [
    body("email").isEmail().normalizeEmail(),
    body("phoneNumber").trim().escape(),
    body("password").trim().escape(),
  ],
  registerLimiter,
  asyncMiddleware(async (req, res) => {
    // Check for validation errors after input sanitization and validation.
    // If any errors are found, return a 400 Bad Request response with the error details.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate the request body
    const { error } = validateUser(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    // Check for existing user by email
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser)
      return res.status(400).send("Email is already registered.");

    // Create a new user
    const user = new User(req.body);

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    // Save the user to the database
    await user.save();

    // Generate and send the authentication token
    const token = user.generateAuthToken();
    res.json({
      token,
      _id: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
    });
  })
);

const validateUser = (user) => {
  const schema = Joi.object({
    email: Joi.string().min(5).max(255).email().required(),
    phoneNumber: Joi.string().min(10).max(15).required(),
    password: Joi.string()
      .min(8)
      .max(255)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
      )
      .required()
      .messages({
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      }),
    role: Joi.string().valid("client", "vendor", "rider", "admin").required(),
  });

  return schema.validate(user);
};

module.exports = router;
