import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

const content = "# Hello World\n\n> **Quote**";
const html = renderToStaticMarkup(React.createElement(ReactMarkdown, null, content));
console.log(html);
