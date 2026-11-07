const express = require("express");
const multer = require("multer");
const pool = require("../db");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
// const { sendTicketEmail } = require("../utils/email");
const router = express.Router();
const {
  sendTicketEmail,
  sendEngineerNotificationEmail,
  sendCommentNotificationEmail,
} = require("../utils/email");
router.use(auth);

// Multer setup with memory storage and 2MB file size limit
const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Basic mimetype pre-check
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only .png, .jpg and .webp format allowed!"), false);
    }
    cb(null, true);
  },
});

// Helper to verify magic numbers from buffer
function isValidImageType(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return true;
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return true;
  // WebP: RIFF ... WEBP (Bytes 0-3 = RIFF, Bytes 8-11 = WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return true;

  return false;
}

const CATEGORIES = ["hardware", "network", "software", "email"];
const PRIORITIES = ["low", "medium", "high"];
const STATUSES = ["open", "in_progress", "resolved"];

const TICKET_SELECT = `
  SELECT t.*, c.name AS created_by_name, a.name AS assigned_to_name
  FROM tickets t
  JOIN users c ON c.id = t.created_by
  LEFT JOIN users a ON a.id = t.assigned_to
`;

router.param("id", (req, res, next, id) => {
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: "Invalid ticket id" });
  }
  next();
});

async function getTicketForUser(id, user) {
  const result = await pool.query(`${TICKET_SELECT} WHERE t.id = $1`, [id]);
  const ticket = result.rows[0];
  if (!ticket) return { error: 404 };
  if (user.role !== "it_staff" && ticket.created_by !== user.id)
    return { error: 403 };
  return { ticket };
}

router.get("/staff", requireRole("it_staff"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM users WHERE role = 'it_staff' ORDER BY name",
    );
    res.json({ staff: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority = "medium",
    } = req.body || {};
    if (!title || !description || !category) {
      return res
        .status(400)
        .json({ error: "Title, description and category are required" });
    }
    if (!CATEGORIES.includes(category))
      return res.status(400).json({ error: "Invalid category" });
    if (!PRIORITIES.includes(priority))
      return res.status(400).json({ error: "Invalid priority" });

    const result = await pool.query(
      `INSERT INTO tickets (title, description, category, priority, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title.trim(), description.trim(), category, priority, req.user.id],
    );
    const full = await pool.query(`${TICKET_SELECT} WHERE t.id = $1`, [
      result.rows[0].id,
    ]);

    const newTicket = full.rows[0];

    // 1. Fetch the creator's email from the database
    const userResult = await pool.query(
      "SELECT email, name FROM users WHERE id = $1",
      [req.user.id],
    );
    const creator = userResult.rows[0];

    // Send user email notification via Resend
    if (creator?.email) {
      console.log("Sending ticket email to user:", creator.email);
      sendTicketEmail(creator.email, newTicket.title, newTicket.id);
    }

    // 2. Fetch an IT staff member / engineer to notify (e.g., Omar)
    const engineerResult = await pool.query(
      "SELECT email FROM users WHERE role = 'IT staff' LIMIT 1",
    );
    const engineer = engineerResult.rows[0];

    // Send engineer notification email via Resend
    if (engineer?.email) {
      console.log("Sending ticket notification to engineer:", engineer.email);
      sendEngineerNotificationEmail(
        engineer.email,
        newTicket.title,
        newTicket.id,
        newTicket.category,
        newTicket.priority,
      );
    }

    res.status(201).json({ ticket: newTicket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status, priority, category, search, assigned } = req.query;
    const conditions = [];
    const values = [];

    if (req.user.role !== "it_staff") {
      values.push(req.user.id);
      conditions.push(`t.created_by = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }
    if (priority) {
      values.push(priority);
      conditions.push(`t.priority = $${values.length}`);
    }
    if (category) {
      values.push(category);
      conditions.push(`t.category = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`t.title ILIKE $${values.length}`);
    }
    if (assigned === "me") {
      values.push(req.user.id);
      conditions.push(`t.assigned_to = $${values.length}`);
    }
    if (assigned === "none") {
      conditions.push("t.assigned_to IS NULL");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `${TICKET_SELECT} ${where} ORDER BY t.created_at DESC`,
      values,
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { ticket, error } = await getTicketForUser(req.params.id, req.user);
    if (error === 404)
      return res.status(404).json({ error: "Ticket not found" });
    if (error === 403) return res.status(403).json({ error: "Not allowed" });

    const comments = await pool.query(
      `SELECT cm.id, cm.body, cm.created_at, u.name AS user_name, u.role AS user_role
       FROM comments cm JOIN users u ON u.id = cm.user_id
       WHERE cm.ticket_id = $1 ORDER BY cm.created_at ASC`,
      [ticket.id],
    );

    const attachments = await pool.query(
      `SELECT id, filename, mime_type, size, created_at
       FROM attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticket.id],
    );

    res.json({
      ticket,
      comments: comments.rows,
      attachments: attachments.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST attachments endpoint
router.post("/:id/attachments", async (req, res) => {
  upload.array("images", 3)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File size exceeds 2MB limit" });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res
            .status(400)
            .json({ error: "Maximum 3 attachments allowed per ticket" });
        }
      }
      return res.status(400).json({ error: err.message || "Upload error" });
    }

    try {
      const { ticket, error } = await getTicketForUser(req.params.id, req.user);
      if (error === 404)
        return res.status(404).json({ error: "Ticket not found" });
      if (error === 403) return res.status(403).json({ error: "Not allowed" });

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Check current attachment count
      const countRes = await pool.query(
        "SELECT COUNT(*) FROM attachments WHERE ticket_id = $1",
        [ticket.id],
      );
      const currentCount = parseInt(countRes.rows[0].count, 10);
      if (currentCount + req.files.length > 3) {
        return res
          .status(400)
          .json({ error: "Maximum 3 attachments allowed per ticket total" });
      }

      const savedAttachments = [];

      for (const file of req.files) {
        // Validate magic numbers
        if (!isValidImageType(file.buffer)) {
          return res.status(400).json({
            error: `Invalid image file content for ${file.originalname}`,
          });
        }

        const insertRes = await pool.query(
          `INSERT INTO attachments (ticket_id, filename, mime_type, size, data)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, filename, mime_type, size, created_at`,
          [ticket.id, file.originalname, file.mimetype, file.size, file.buffer],
        );
        savedAttachments.push(insertRes.rows[0]);
      }

      res.status(201).json({ attachments: savedAttachments });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: "Server error" });
    }
  });
});

// GET specific attachment image endpoint
router.get("/:id/attachments/:attId", async (req, res) => {
  try {
    const { ticket, error } = await getTicketForUser(req.params.id, req.user);
    if (error === 404)
      return res.status(404).json({ error: "Ticket not found" });
    if (error === 403) return res.status(403).json({ error: "Not allowed" });

    const attRes = await pool.query(
      "SELECT filename, mime_type, data FROM attachments WHERE id = $1 AND ticket_id = $2",
      [req.params.attId, ticket.id],
    );

    const attachment = attRes.rows[0];
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    res.setHeader("Content-Type", attachment.mime_type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(attachment.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/status", requireRole("it_staff"), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const result = await pool.query(
      `UPDATE tickets
       SET status = $1::text, resolved_at = CASE WHEN $1::text = 'resolved' THEN NOW() ELSE NULL END
       WHERE id = $2 RETURNING id`,
      [status, req.params.id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Ticket not found" });

    const full = await pool.query(`${TICKET_SELECT} WHERE t.id = $1`, [
      req.params.id,
    ]);
    const updatedTicket = full.rows[0];

    // Fetch the creator's email to notify them of the status change
    const userResult = await pool.query(
      "SELECT email FROM users WHERE id = $1",
      [updatedTicket.created_by],
    );
    const creator = userResult.rows[0];

    if (creator?.email) {
      console.log("Sending status update email to:", creator.email);
      sendCommentNotificationEmail(
        creator.email,
        req.params.id,
        updatedTicket.title,
        `Your ticket status has been updated to: ${updatedTicket.status}`,
        updatedTicket.status,
      );
    }

    res.json({ ticket: updatedTicket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/assign", requireRole("it_staff"), async (req, res) => {
  try {
    const assignedTo = (req.body && req.body.assigned_to) || req.user.id;

    const staff = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'it_staff'",
      [assignedTo],
    );
    if (staff.rows.length === 0)
      return res.status(400).json({ error: "Can only assign to IT staff" });

    const result = await pool.query(
      "UPDATE tickets SET assigned_to = $1 WHERE id = $2 RETURNING id",
      [assignedTo, req.params.id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Ticket not found" });

    const full = await pool.query(`${TICKET_SELECT} WHERE t.id = $1`, [
      req.params.id,
    ]);
    res.json({ ticket: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const { body } = req.body || {};
    if (!body || !body.trim())
      return res.status(400).json({ error: "Comment cannot be empty" });

    const { ticket, error } = await getTicketForUser(req.params.id, req.user);
    if (error === 404)
      return res.status(404).json({ error: "Ticket not found" });
    if (error === 403) return res.status(403).json({ error: "Not allowed" });

    const result = await pool.query(
      `INSERT INTO comments (ticket_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [req.params.id, req.user.id, body.trim()],
    );
    const newComment = result.rows[0];

    // Fetch ticket info and creator's email to send notification
    const ticketQuery = await pool.query(
      `SELECT t.title, t.status, u.email 
       FROM tickets t 
       JOIN users u ON t.created_by = u.id 
       WHERE t.id = $1`,
      [req.params.id],
    );
    const ticketInfo = ticketQuery.rows[0];

    if (ticketInfo?.email) {
      console.log("Sending comment notification email to:", ticketInfo.email);
      sendCommentNotificationEmail(
        ticketInfo.email,
        req.params.id,
        ticketInfo.title,
        newComment.body,
        ticketInfo.status,
      );
    }

    res.status(201).json({
      comment: {
        ...newComment,
        user_name: req.user.name,
        user_role: req.user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
