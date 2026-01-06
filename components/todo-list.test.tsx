import { describe, expect, test } from "bun:test";
import type { TodoListProps } from "./todo-list";

describe("TodoList", () => {
  test("exports TodoListProps type with userRole", () => {
    const props: TodoListProps = {
      userRole: "member",
    };

    expect(props.userRole).toBe("member");
  });

  test("accepts owner role", () => {
    const props: TodoListProps = {
      userRole: "owner",
    };

    expect(props.userRole).toBe("owner");
  });

  test("accepts admin role", () => {
    const props: TodoListProps = {
      userRole: "admin",
    };

    expect(props.userRole).toBe("admin");
  });

  test("accepts member role", () => {
    const props: TodoListProps = {
      userRole: "member",
    };

    expect(props.userRole).toBe("member");
  });
});
