const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();
router.use(auth);

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
    res.status(201).json({ ticket: full.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { status, priority, category, search } = req.query;
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
    res.json({ ticket, comments: comments.rows });
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
    res.json({ ticket: full.rows[0] });
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
      [ticket.id, req.user.id, body.trim()],
    );
    res.status(201).json({
      comment: {
        ...result.rows[0],
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
