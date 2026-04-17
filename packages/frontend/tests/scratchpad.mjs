import { unified } from 'unified';
import markdown from 'remark-parse';

const text = "hello\\n# heading";
console.log(JSON.stringify(unified().use(markdown).parse(text), null, 2));
