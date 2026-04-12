import { unified } from 'remark';
import markdown from 'remark-parse';

const text = "hello\\n# heading";
console.log(unified().use(markdown).parse(text));
