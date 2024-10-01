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
exports.loginInstagram = loginInstagram;
exports.searchInstagram = searchInstagram;
exports.getInstagramFollowers = getInstagramFollowers;
const instagram_web_api_1 = __importDefault(require("instagram-web-api"));
const utils_1 = require("./utils");
let client = null;
function loginInstagram(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        client = new instagram_web_api_1.default({
            username,
            password,
        });
        yield client.login();
    });
}
function searchInstagram(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!client)
            return null;
        const users = yield client.search({ query: query });
        return users.users;
    });
}
function getInstagramFollowers(username) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!client)
            return null;
        const userHtml = yield (client === null || client === void 0 ? void 0 : client.getUserByUsername({ username }));
        return (0, utils_1.extractInstagramFollowers)(userHtml);
    });
}
