const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// 1. Email to the user who created the ticket
async function sendTicketEmail(toEmail, ticketTitle, ticketId) {
  try {
    const recipient = "abdulroqeebibrahim@gmail.com";

    const data = await resend.emails.send({
      from: "QuickDesk <onboarding@resend.dev>",
      to: [recipient],
      subject: `[QuickDesk] New Ticket from Portfolio: #${ticketId} - ${ticketTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>New Support Ticket Submitted</h2>
          <p>A user submitted a ticket through your portfolio application.</p>
          <p><strong>Ticket ID:</strong> #${ticketId}</p>
          <p><strong>Title:</strong> ${ticketTitle}</p>
          <p><strong>Submitted By:</strong> ${toEmail}</p>
        </div>
      `,
    });

    console.log("Portfolio ticket email sent successfully:", data);
  } catch (error) {
    console.error("Failed to send portfolio email:", error);
  }
}

// 2. Email alert to IT Engineers (Forced to your inbox)
async function sendEngineerNotificationEmail(
  engineerEmail,
  ticketTitle,
  ticketId,
  category,
  priority,
) {
  try {
    const recipient = "abdulroqeebibrahim@gmail.com";

    const data = await resend.emails.send({
      from: "QuickDesk <onboarding@resend.dev>",
      to: [recipient],
      subject: `[Action Required] New Ticket #${ticketId}: ${ticketTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>New Ticket Assigned to Queue</h2>
          <p>Hello IT Team,</p>
          <p>A new support ticket has been submitted and requires review.</p>
          <p><strong>Ticket ID:</strong> #${ticketId}</p>
          <p><strong>Title:</strong> ${ticketTitle}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Priority:</strong> ${priority}</p>
          <p><strong>Assigned Engineer Target:</strong> ${engineerEmail}</p>
          <p>Please log into QuickDesk to review and take action.</p>
          <br/>
          <p>Best regards,<br/><strong>QuickDesk Automation</strong></p>
        </div>
      `,
    });
    console.log("Engineer notification email sent:", data);
  } catch (error) {
    console.error("Failed to send engineer email via Resend:", error);
  }
}

// 3. Email notification when a comment or status update is added
async function sendCommentNotificationEmail(
  toEmail,
  ticketId,
  ticketTitle,
  commentText,
  status,
) {
  try {
    const recipient = "abdulroqeebibrahim@gmail.com";

    const data = await resend.emails.send({
      from: "QuickDesk <onboarding@resend.dev>",
      to: [recipient],
      subject: `[QuickDesk] Update on Ticket #${ticketId}: ${ticketTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Ticket Update: #${ticketId}</h2>
          <p>Hello,</p>
          <p>There is a new update on your support ticket <strong>"${ticketTitle}"</strong>.</p>
          <p><strong>Current Status:</strong> ${status}</p>
          <p><strong>Intended Recipient:</strong> ${toEmail}</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p><strong>Latest Comment/Update:</strong></p>
          <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #007bff; margin: 0;">
            ${commentText}
          </blockquote>
          <br/>
          <p>You can log into QuickDesk to view the full conversation and reply.</p>
          <br/>
          <p>Best regards,<br/><strong>QuickDesk Support Team</strong></p>
        </div>
      `,
    });
    console.log("Comment/status notification email sent:", data);
  } catch (error) {
    console.error(
      "Failed to send comment notification email via Resend:",
      error,
    );
  }
}

module.exports = {
  sendTicketEmail,
  sendEngineerNotificationEmail,
  sendCommentNotificationEmail,
};
