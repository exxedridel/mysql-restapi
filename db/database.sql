/* - - - - - - - - - - table employees - - - - - - - - - - - */
CREATE DATABASE IF NOT EXISTS companydb;

USE companydb;

CREATE TABLE employees (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(45) DEFAULT NULL,
    salary INT(5) DEFAULT NULL,
    PRIMARY KEY (id) 
);

DESCRIBE employees;

INSERT INTO employees VALUES
 (1, 'Joe', 1000),
 (2, 'Henry', 2000),
 (3, 'Sam', 2500),
 (4, 'Max', 1500);

 /* - - - - - - - - - - table tasks - - - - - - - - - - - - - */
 
 CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(300),
    isDone BOOLEAN NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks(title, description) VALUES ('Amazing tasks', 'Do de tasks asap');