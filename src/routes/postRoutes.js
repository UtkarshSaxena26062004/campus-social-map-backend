const express = require("express");
const Post = require("../models/Post");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { type, search, tag } = req.query;

    const query = {};
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { locationText: { $regex: search, $options: "i" } },
      ];
    }
    if (tag) {
      query.tags = tag;
    }

    const posts = await Post.find(query)
      .populate("createdBy", "name branch year")
      .populate("participants", "name")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error("Get posts error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { title, description, type, locationText, date, time, tags, imageUrl } = req.body;

    const post = await Post.create({
      title,
      description,
      type,
      locationText,
      date,
      time,
      tags,
      imageUrl,
      createdBy: req.user._id,
      participants: []
    });

    // 👇 Socket.io event emit
    const io = req.app.get("io");
    if (io) {
      io.emit("postCreated", {
        _id: post._id,
        title: post.title,
        type: post.type,
        createdAt: post.createdAt
      });
    }

    res.status(201).json(post);
  } catch (error) {
    console.error("Create post error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("createdBy", "name branch year")
      .populate("participants", "name");

    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json(post);
  } catch (error) {
    console.error("Get post error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/join", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.participants.includes(req.user._id)) {
      post.participants.push(req.user._id);
      await post.save();
    }

    res.json({ message: "Joined successfully" });
  } catch (error) {
    console.error("Join post error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/leave", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.participants = post.participants.filter(
      (id) => id.toString() !== req.user._id.toString()
    );
    await post.save();

    res.json({ message: "Left successfully" });
  } catch (error) {
    console.error("Leave post error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
