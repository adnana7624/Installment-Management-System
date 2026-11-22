
import { google } from "googleapis";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const tokenDirectory = path.join(process.cwd(), "storage");
const tokenPath = path.join(tokenDirectory, "google-drive-tokens.json");

let currentOAuthState = null;

// Create Google OAuth client
export const createGoogleOAuthClient = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

// Generate Google authorization URL
export const generateGoogleAuthUrl = () => {
    const oauth2Client = createGoogleOAuthClient();

    currentOAuthState = crypto.randomBytes(32).toString("hex");

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/drive.file"
        ],
        state: currentOAuthState
    });

    return authUrl;
};

// Verify authorization state and save Google tokens
export const saveGoogleTokens = async (code, state) => {
    if (!currentOAuthState || state !== currentOAuthState) {
        throw new Error("Invalid Google authorization state.");
    }

    currentOAuthState = null;

    const oauth2Client = createGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await fs.mkdir(tokenDirectory, { recursive: true });

    await fs.writeFile(
        tokenPath,
        JSON.stringify(tokens, null, 2),
        "utf8"
    );

    return tokens;
};

// Check whether Google Drive is connected
export const isGoogleDriveConnected = async () => {
    try {
        await fs.access(tokenPath);
        return true;
    } catch {
        return false;
    }
};

// Get authorized Google Drive client
export const getGoogleDriveClient = async () => {
    const oauth2Client = createGoogleOAuthClient();

    const tokenData = await fs.readFile(tokenPath, "utf8");
    const tokens = JSON.parse(tokenData);

    oauth2Client.setCredentials(tokens);

    // Save refreshed access tokens
    oauth2Client.on("tokens", async (newTokens) => {
        try {
            const updatedTokens = {
                ...tokens,
                ...newTokens
            };

            await fs.writeFile(
                tokenPath,
                JSON.stringify(updatedTokens, null, 2),
                "utf8"
            );
        } catch (error) {
            console.error("Google token update failed:", error.message);
        }
    });

    return google.drive({
        version: "v3",
        auth: oauth2Client
    });
};
