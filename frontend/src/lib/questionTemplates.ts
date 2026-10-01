export type SupportedLanguage = 'python' | 'javascript' | 'java' | 'c' | 'cpp';

export interface LanguageVariant {
  language: SupportedLanguage;
  label: string;
  badge: string;
  monacoLang: string;
  buggy_code: string;
  editable_line_ranges: number[][];
}

export interface MultiLangQuestion {
  id: string;
  round_id: string;
  title: string;
  marks: number;
  expected_output: string;
  variants: Record<SupportedLanguage, LanguageVariant>;
}

export const LANGUAGE_OPTIONS: { id: SupportedLanguage; label: string; icon: string; monacoLang: string }[] = [
  { id: 'python', label: 'Python', icon: '🐍', monacoLang: 'python' },
  { id: 'javascript', label: 'JavaScript', icon: '🟨', monacoLang: 'javascript' },
  { id: 'java', label: 'Java', icon: '☕', monacoLang: 'java' },
  { id: 'c', label: 'C', icon: '🔷', monacoLang: 'c' },
  { id: 'cpp', label: 'C++', icon: '⚡', monacoLang: 'cpp' },
];

export const DEFAULT_QUESTIONS: MultiLangQuestion[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    round_id: '22222222-2222-2222-2222-222222222222',
    title: '1. Buggy Greeting',
    marks: 10,
    expected_output: 'Hello, World',
    variants: {
      python: {
        language: 'python',
        label: 'Python',
        badge: '🐍 Python',
        monacoLang: 'python',
        buggy_code: `def greet(name):
    # Fix this to return "Hello, [name]"
    return "Goodbye, " + name

print(greet("World"))`,
        editable_line_ranges: [[3, 3]]
      },
      javascript: {
        language: 'javascript',
        label: 'JavaScript',
        badge: '🟨 JavaScript',
        monacoLang: 'javascript',
        buggy_code: `function greet(name) {
    // Fix this to return "Hello, [name]"
    return "Goodbye, " + name;
}

console.log(greet("World"));`,
        editable_line_ranges: [[3, 3]]
      },
      java: {
        language: 'java',
        label: 'Java',
        badge: '☕ Java',
        monacoLang: 'java',
        buggy_code: `public class Main {
    public static String greet(String name) {
        // Fix this to return "Hello, [name]"
        return "Goodbye, " + name;
    }

    public static void main(String[] args) {
        System.out.println(greet("World"));
    }
}`,
        editable_line_ranges: [[4, 4]]
      },
      c: {
        language: 'c',
        label: 'C',
        badge: '🔷 C',
        monacoLang: 'c',
        buggy_code: `#include <stdio.h>

void greet(const char* name) {
    // Fix this to print "Hello, [name]"
    printf("Goodbye, %s\\n", name);
}

int main() {
    greet("World");
    return 0;
}`,
        editable_line_ranges: [[5, 5]]
      },
      cpp: {
        language: 'cpp',
        label: 'C++',
        badge: '⚡ C++',
        monacoLang: 'cpp',
        buggy_code: `#include <iostream>
#include <string>

std::string greet(const std::string& name) {
    // Fix this to return "Hello, [name]"
    return "Goodbye, " + name;
}

int main() {
    std::cout << greet("World") << std::endl;
    return 0;
}`,
        editable_line_ranges: [[6, 6]]
      }
    }
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    round_id: '22222222-2222-2222-2222-222222222222',
    title: '2. Array Sum',
    marks: 15,
    expected_output: '100',
    variants: {
      python: {
        language: 'python',
        label: 'Python',
        badge: '🐍 Python',
        monacoLang: 'python',
        buggy_code: `def sum_array(arr):
    total = 0
    # Bug: loop starts at index 1 instead of 0
    for i in range(1, len(arr)):
        total += arr[i]
    return total

print(sum_array([10, 20, 30, 40]))`,
        editable_line_ranges: [[4, 4]]
      },
      javascript: {
        language: 'javascript',
        label: 'JavaScript',
        badge: '🟨 JavaScript',
        monacoLang: 'javascript',
        buggy_code: `function sumArray(arr) {
    let total = 0;
    // Bug: loop starts at index 1 instead of 0
    for (let i = 1; i < arr.length; i++) {
        total += arr[i];
    }
    return total;
}

console.log(sumArray([10, 20, 30, 40]));`,
        editable_line_ranges: [[4, 4]]
      },
      java: {
        language: 'java',
        label: 'Java',
        badge: '☕ Java',
        monacoLang: 'java',
        buggy_code: `public class Main {
    public static int sumArray(int[] arr) {
        int total = 0;
        // Bug: loop starts at index 1 instead of 0
        for (int i = 1; i < arr.length; i++) {
            total += arr[i];
        }
        return total;
    }

    public static void main(String[] args) {
        int[] numbers = {10, 20, 30, 40};
        System.out.println(sumArray(numbers));
    }
}`,
        editable_line_ranges: [[5, 5]]
      },
      c: {
        language: 'c',
        label: 'C',
        badge: '🔷 C',
        monacoLang: 'c',
        buggy_code: `#include <stdio.h>

int sum_array(int arr[], int n) {
    int total = 0;
    // Bug: loop starts at index 1 instead of 0
    for (int i = 1; i < n; i++) {
        total += arr[i];
    }
    return total;
}

int main() {
    int nums[] = {10, 20, 30, 40};
    printf("%d\\n", sum_array(nums, 4));
    return 0;
}`,
        editable_line_ranges: [[6, 6]]
      },
      cpp: {
        language: 'cpp',
        label: 'C++',
        badge: '⚡ C++',
        monacoLang: 'cpp',
        buggy_code: `#include <iostream>
#include <vector>

int sumArray(const std::vector<int>& arr) {
    int total = 0;
    // Bug: loop starts at index 1 instead of 0
    for (size_t i = 1; i < arr.size(); i++) {
        total += arr[i];
    }
    return total;
}

int main() {
    std::cout << sumArray({10, 20, 30, 40}) << std::endl;
    return 0;
}`,
        editable_line_ranges: [[7, 7]]
      }
    }
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    round_id: '22222222-2222-2222-2222-222222222222',
    title: '3. Even or Odd',
    marks: 10,
    expected_output: 'Even',
    variants: {
      python: {
        language: 'python',
        label: 'Python',
        badge: '🐍 Python',
        monacoLang: 'python',
        buggy_code: `def check_even_odd(n):
    # Bug: inverted condition
    if n % 2 != 0:
        return "Even"
    else:
        return "Odd"

print(check_even_odd(42))`,
        editable_line_ranges: [[3, 3]]
      },
      javascript: {
        language: 'javascript',
        label: 'JavaScript',
        badge: '🟨 JavaScript',
        monacoLang: 'javascript',
        buggy_code: `function checkEvenOdd(n) {
    // Bug: inverted condition
    if (n % 2 !== 0) {
        return "Even";
    } else {
        return "Odd";
    }
}

console.log(checkEvenOdd(42));`,
        editable_line_ranges: [[3, 3]]
      },
      java: {
        language: 'java',
        label: 'Java',
        badge: '☕ Java',
        monacoLang: 'java',
        buggy_code: `public class Main {
    public static String checkEvenOdd(int n) {
        // Bug: inverted condition
        if (n % 2 != 0) {
            return "Even";
        } else {
            return "Odd";
        }
    }

    public static void main(String[] args) {
        System.out.println(checkEvenOdd(42));
    }
}`,
        editable_line_ranges: [[4, 4]]
      },
      c: {
        language: 'c',
        label: 'C',
        badge: '🔷 C',
        monacoLang: 'c',
        buggy_code: `#include <stdio.h>

const char* check_even_odd(int n) {
    // Bug: inverted condition
    if (n % 2 != 0) {
        return "Even";
    } else {
        return "Odd";
    }
}

int main() {
    printf("%s\\n", check_even_odd(42));
    return 0;
}`,
        editable_line_ranges: [[5, 5]]
      },
      cpp: {
        language: 'cpp',
        label: 'C++',
        badge: '⚡ C++',
        monacoLang: 'cpp',
        buggy_code: `#include <iostream>
#include <string>

std::string checkEvenOdd(int n) {
    // Bug: inverted condition
    if (n % 2 != 0) {
        return "Even";
    } else {
        return "Odd";
    }
}

int main() {
    std::cout << checkEvenOdd(42) << std::endl;
    return 0;
}`,
        editable_line_ranges: [[6, 6]]
      }
    }
  }
];

// Helper to convert DB question into multi-lang question structure
export function resolveMultiLangQuestion(rawQ: any): MultiLangQuestion {
  // Check if it matches one of our known templates by ID or title
  const found = DEFAULT_QUESTIONS.find(d => d.id === rawQ.id || d.title.toLowerCase() === (rawQ.title || '').toLowerCase());
  if (found) return found;

  const baseLang = (rawQ.language || 'python') as SupportedLanguage;
  const editableRanges = Array.isArray(rawQ.editable_line_ranges) ? rawQ.editable_line_ranges : [[3, 3]];

  // If custom question from DB without predefined variants, construct fallback variants
  return {
    id: rawQ.id,
    round_id: rawQ.round_id,
    title: rawQ.title,
    marks: rawQ.marks || 10,
    expected_output: '',
    variants: {
      python: {
        language: 'python',
        label: 'Python',
        badge: '🐍 Python',
        monacoLang: 'python',
        buggy_code: baseLang === 'python' ? rawQ.buggy_code : `# Python implementation\n${rawQ.buggy_code}`,
        editable_line_ranges: editableRanges
      },
      javascript: {
        language: 'javascript',
        label: 'JavaScript',
        badge: '🟨 JavaScript',
        monacoLang: 'javascript',
        buggy_code: baseLang === 'javascript' ? rawQ.buggy_code : `// JavaScript implementation\n${rawQ.buggy_code}`,
        editable_line_ranges: editableRanges
      },
      java: {
        language: 'java',
        label: 'Java',
        badge: '☕ Java',
        monacoLang: 'java',
        buggy_code: baseLang === 'java' ? rawQ.buggy_code : `public class Main {\n    public static void main(String[] args) {\n        // Java implementation\n    }\n}`,
        editable_line_ranges: [[3, 3]]
      },
      c: {
        language: 'c',
        label: 'C',
        badge: '🔷 C',
        monacoLang: 'c',
        buggy_code: baseLang === 'c' ? rawQ.buggy_code : `#include <stdio.h>\nint main() {\n    // C implementation\n    return 0;\n}`,
        editable_line_ranges: [[3, 3]]
      },
      cpp: {
        language: 'cpp',
        label: 'C++',
        badge: '⚡ C++',
        monacoLang: 'cpp',
        buggy_code: baseLang === 'cpp' ? rawQ.buggy_code : `#include <iostream>\nint main() {\n    // C++ implementation\n    return 0;\n}`,
        editable_line_ranges: [[3, 3]]
      }
    }
  };
}
