'use strict';
const PATTERNS = [['OpenRouter key', /sk-or-v1-[A-Za-z0-9]{20,}/], ['Groq key', /gsk_[A-Za-z0-9]{20,}/], ['OpenAI-style key', /sk-[A-Za-z0-9]{32,}/], ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/], ['AWS access key', /AKIA[0-9A-Z]{16}/], ['Google API key', /AIza[0-9A-Za-z_-]{30,}/], ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]];
const findSecrets = (text) => PATTERNS.filter(([, re]) => re.test(text)).map(([n]) => n); module.exports = { findSecrets };
