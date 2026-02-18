import { CodeBlock } from "../codeblock";

export const CodeblockExample = () => {
  return (
    <div className="w-full space-y-8">
      <CodeBlock
        code={`// JavaScript example
const greeting = "Hello, world!";
console.log(greeting);

// Working with arrays
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(num => num * 2);
console.log(doubled);

// Object manipulation
const user = {
    name: 'John Doe',
    age: 30,
    hobbies: ['reading', 'coding']
};

const { name, age } = user;
console.log(\`\${name} is \${age} years old\`);

// Async/await example
async function fetchData() {
    try {
        const response = await fetch('https://api.example.com/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}`}
        lang="javascript"
      />

      <CodeBlock
        code={`type User = {
    id: string;
    name: string;
    email: string;
    age: number;
    preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
    };
};

const processUser = (user: User): string => {
    const { name, preferences } = user;
    return \`User \${name} prefers \${preferences.theme} theme\`;
};

const users: User[] = [
    {
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
        age: 28,
        preferences: {
            theme: 'dark',
            notifications: true
        }
    }
];`}
        lang="typescript"
      />

      <CodeBlock
        code={`SELECT 
    users.name,
    COUNT(orders.id) as total_orders,
    SUM(orders.amount) as total_spent
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE orders.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
GROUP BY users.id
HAVING total_orders > 5
ORDER BY total_spent DESC
LIMIT 10;`}
        lang="sql"
      />
    </div>
  );
};
