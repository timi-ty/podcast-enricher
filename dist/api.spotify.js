"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Type = exports.MediaType = void 0;
exports.searchSpotify = searchSpotify;
const axios_1 = __importDefault(require("axios"));
function getSpotifyAccessToken() {
    return __awaiter(this, void 0, void 0, function* () {
        var authOptions = {
            url: "https://accounts.spotify.com/api/token",
            form: {
                grant_type: "refresh_token",
                refresh_token: "AQCquMgqNgzATgmK1z4rQYE6f9gWD0FIoGcCxg5HseXziQZUuVGjbXYrwJxCYwyduPbb51JSaaaBz2JfXG84OcsHwDHmsHX8G_alTmgwn0dOp9fR3pphIO9bJujEtrNsdz4",
            },
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                Authorization: "Basic " +
                    Buffer.from(process.env.SPOTIFY_CLIENT_ID +
                        ":" +
                        process.env.SPOTIFY_CLIENT_SECRET).toString("base64"),
            },
            json: true,
        };
        const response = yield axios_1.default.post(authOptions.url, authOptions.form, {
            headers: authOptions.headers,
        });
        return response.data.access_token;
    });
}
function searchSpotify(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const accessToken = yield getSpotifyAccessToken();
        const response = yield axios_1.default.get("https://api.spotify.com/v1/search", {
            params: {
                q: query,
                type: "show",
            },
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.data;
    });
}
var MediaType;
(function (MediaType) {
    MediaType["Audio"] = "audio";
    MediaType["Mixed"] = "mixed";
})(MediaType || (exports.MediaType = MediaType = {}));
var Type;
(function (Type) {
    Type["Show"] = "show";
})(Type || (exports.Type = Type = {}));
