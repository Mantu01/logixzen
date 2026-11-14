-- ============================================================
-- LogixZen Sample Databases
-- ============================== school ==============================
-- School Management System
-- Schema + Seed Data
-- ============================================================

-- -----------------------------------------------------------
-- Database: school
-- Description: A complete school management system with students,
-- teachers, courses, enrollments, departments, books, loans,
-- and authors. Designed to exercise every major SQL concept.
-- -----------------------------------------------------------

CREATE TABLE departments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    building TEXT NOT NULL,
    floor INTEGER NOT NULL DEFAULT 1,
    head_teacher_id INTEGER,
    budget REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE teachers (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    department_id INTEGER NOT NULL,
    hire_date TEXT NOT NULL DEFAULT (date('now')),
    salary REAL NOT NULL DEFAULT 50000.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE subjects (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    department_id INTEGER NOT NULL,
    credits INTEGER NOT NULL DEFAULT 3,
    prerequisite_subject_id INTEGER,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (prerequisite_subject_id) REFERENCES subjects(id)
);

CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    date_of_birth TEXT NOT NULL,
    gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    enrollment_date TEXT NOT NULL DEFAULT (date('now')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Graduated', 'Suspended', 'Withdrawn')),
    gpa REAL CHECK(gpa >= 0.0 AND gpa <= 4.0),
    department_id INTEGER NOT NULL,
    advisor_teacher_id INTEGER,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (advisor_teacher_id) REFERENCES teachers(id)
);

CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    subject_id INTEGER NOT NULL,
    course_number TEXT NOT NULL,
    section TEXT NOT NULL,
    semester TEXT NOT NULL CHECK(semester IN ('Fall', 'Spring', 'Summer')),
    year INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    room TEXT,
    max_students INTEGER NOT NULL DEFAULT 30,
    enrolled_count INTEGER NOT NULL DEFAULT 0,
    schedule TEXT,
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE enrollments (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrollment_date TEXT NOT NULL DEFAULT (date('now')),
    grade TEXT,
    grade_points REAL,
    status TEXT NOT NULL DEFAULT 'Enrolled' CHECK(status IN ('Enrolled', 'Dropped', 'Completed', 'In Progress')),
    attendance_percentage REAL CHECK(attendance_percentage >= 0 AND attendance_percentage <= 100),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE(student_id, course_id)
);

CREATE TABLE authors (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    bio TEXT,
    nationality TEXT,
    birth_year INTEGER,
    death_year INTEGER
);

CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    isbn TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    published_year INTEGER,
    price REAL NOT NULL DEFAULT 0.0,
    stock INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    subject_id INTEGER,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE book_authors (
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE TABLE loans (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    loan_date TEXT NOT NULL DEFAULT (date('now')),
    due_date TEXT NOT NULL,
    return_date TEXT,
    fine REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Returned', 'Overdue')),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE exams (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    exam_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    total_marks REAL NOT NULL,
    duration_minutes INTEGER NOT NULL,
    exam_type TEXT NOT NULL CHECK(exam_type IN ('Quiz', 'Midterm', 'Final', 'Lab', 'Project')),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE exam_results (
    id INTEGER PRIMARY KEY,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    marks_obtained REAL NOT NULL,
    submitted_at TEXT,
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    UNIQUE(exam_id, student_id)
);

CREATE TABLE scholarships (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    GPA_requirement REAL NOT NULL DEFAULT 0.0,
    min_age INTEGER,
    max_age INTEGER,
    department_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE student_scholarships (
    student_id INTEGER NOT NULL,
    scholarship_id INTEGER NOT NULL,
    awarded_date TEXT NOT NULL DEFAULT (date('now')),
    amount_awarded REAL NOT NULL,
    PRIMARY KEY (student_id, scholarship_id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (scholarship_id) REFERENCES scholarships(id)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Departments
INSERT INTO departments (id, name, building, floor, head_teacher_id, budget) VALUES
(1, 'Computer Science', 'Tech Hall', 1, 1, 250000.00),
(2, 'Mathematics', 'Science Block', 2, 5, 180000.00),
(3, 'English Literature', 'Arts Building', 1, 9, 120000.00),
(4, 'Physics', 'Science Block', 3, 12, 300000.00),
(5, 'Chemistry', 'Science Block', 3, 15, 220000.00),
(6, 'History', 'Arts Building', 2, NULL, 95000.00),
(7, 'Economics', 'Business Wing', 1, 20, 160000.00),
(8, 'Biology', 'Science Block', 4, 23, 280000.00);

-- Teachers
INSERT INTO teachers (id, first_name, last_name, email, phone, department_id, hire_date, salary, is_active) VALUES
(1, 'Alan', 'Turing', 'alan.turing@logixzen.edu', '555-0101', 1, '2015-09-01', 95000.00, 1),
(2, 'Grace', 'Hopper', 'grace.hopper@logixzen.edu', '555-0102', 1, '2016-03-15', 92000.00, 1),
(3, 'Donald', 'Knuth', 'donald.knuth@logixzen.edu', '555-0103', 1, '2017-01-10', 88000.00, 1),
(4, 'Linus', 'Torvalds', 'linus.torvalds@logixzen.edu', '555-0104', 1, '2018-06-20', 85000.00, 0),
(5, 'Carl', 'Friedrich', 'carl.friedrich@logixzen.edu', '555-0105', 2, '2014-08-01', 90000.00, 1),
(6, 'Ada', 'Lovelace', 'ada.lovelace@logixzen.edu', '555-0106', 2, '2015-02-14', 87000.00, 1),
(7, 'Leonhard', 'Euler', 'leonhard.euler@logixzen.edu', '555-0107', 2, '2016-09-01', 84000.00, 1),
(8, 'Euclid', 'Alexandria', 'euclid@logixzen.edu', '555-0108', 2, '2019-01-15', 78000.00, 1),
(9, 'William', 'Shakespeare', 'william.shakespeare@logixzen.edu', '555-0109', 3, '2013-07-01', 91000.00, 1),
(10, 'Jane', 'Austen', 'jane.austen@logixzen.edu', '555-0110', 3, '2014-03-20', 86000.00, 1),
(11, 'George', 'Orwell', 'george.orwell@logixzen.edu', '555-0111', 3, '2015-11-05', 83000.00, 1),
(12, 'Isaac', 'Newton', 'isaac.newton@logixzen.edu', '555-0112', 4, '2012-01-01', 98000.00, 1),
(13, 'Marie', 'Curie', 'marie.curie@logixzen.edu', '555-0113', 4, '2013-06-15', 94000.00, 1),
(14, 'Richard', 'Feynman', 'richard.feynman@logixzen.edu', '555-0114', 4, '2014-09-01', 91000.00, 1),
(15, 'Antoine', 'Lavoisier', 'antoine.lavoisier@logixzen.edu', '555-0115', 5, '2015-03-01', 88000.00, 1),
(16, 'Dmitri', 'Mendeleev', 'dmitri.mendeleev@logixzen.edu', '555-0116', 5, '2016-07-20', 85000.00, 1),
(17, 'Rosalind', 'Franklin', 'rosalind.franklin@logixzen.edu', '555-0117', 5, '2017-01-10', 82000.00, 1),
(18, 'David', 'Hume', 'david.hume@logixzen.edu', '555-0118', 6, '2014-05-01', 80000.00, 1),
(19, 'Mary', 'Sequel', 'mary.sequel@logixzen.edu', '555-0119', 6, '2015-08-15', 77000.00, 1),
(20, 'Adam', 'Smith', 'adam.smith@logixzen.edu', '555-0120', 7, '2013-02-01', 93000.00, 1),
(21, 'Karl', 'Marx', 'karl.marx@logixzen.edu', '555-0121', 7, '2014-10-01', 90000.00, 1),
(22, 'Milton', 'Friedman', 'milton.friedman@logixzen.edu', '555-0122', 7, '2016-04-15', 87000.00, 0),
(23, 'Charles', 'Darwin', 'charles.darwin@logixzen.edu', '555-0123', 8, '2012-06-01', 96000.00, 1),
(24, 'Gregor', 'Mendel', 'gregor.mendel@logixzen.edu', '555-0124', 8, '2013-09-15', 92000.00, 1),
(25, 'Louis', 'Pasteur', 'louis.pasteur@logixzen.edu', '555-0125', 8, '2014-01-20', 89000.00, 1);

-- Update department heads
UPDATE departments SET head_teacher_id = 1 WHERE id = 1;
UPDATE departments SET head_teacher_id = 5 WHERE id = 2;
UPDATE departments SET head_teacher_id = 9 WHERE id = 3;
UPDATE departments SET head_teacher_id = 12 WHERE id = 4;
UPDATE departments SET head_teacher_id = 15 WHERE id = 5;
UPDATE departments SET head_teacher_id = 18 WHERE id = 6;
UPDATE departments SET head_teacher_id = 20 WHERE id = 7;
UPDATE departments SET head_teacher_id = 23 WHERE id = 8;

-- Subjects
INSERT INTO subjects (id, code, name, description, department_id, credits, prerequisite_subject_id) VALUES
(1, 'CS101', 'Intro to Programming', 'Learn programming fundamentals with Python', 1, 4, NULL),
(2, 'CS201', 'Data Structures', 'Arrays, linked lists, trees, graphs and algorithms', 1, 4, 1),
(3, 'CS301', 'Database Systems', 'Relational databases, SQL, normalization and transactions', 1, 4, 2),
(4, 'CS401', 'Operating Systems', 'Process management, memory, file systems', 1, 4, 2),
(5, 'MATH101', 'Calculus I', 'Limits, derivatives and integrals', 2, 4, NULL),
(6, 'MATH201', 'Linear Algebra', 'Vectors, matrices, eigenvalues and eigenvectors', 2, 3, 5),
(7, 'MATH301', 'Discrete Mathematics', 'Logic, sets, combinatorics and graph theory', 2, 3, NULL),
(8, 'ENG101', 'English Composition', 'Academic writing and rhetoric', 3, 3, NULL),
(9, 'ENG201', 'Shakespearean Drama', 'Analysis of Shakespeare plays', 3, 3, 8),
(10, 'PHY101', 'Classical Mechanics', 'Newtonian physics, kinematics and dynamics', 4, 4, NULL),
(11, 'PHY201', 'Electromagnetism', 'Electric and magnetic fields, Maxwell equations', 4, 4, 10),
(12, 'CHM101', 'General Chemistry', 'Atomic structure, bonding and reactions', 5, 4, NULL),
(13, 'HIST101', 'World History', 'Survey of major civilizations', 6, 3, NULL),
(14, 'HIST201', 'Modern Europe', 'European history from 1600 to present', 6, 3, 13),
(15, 'ECO101', 'Microeconomics', 'Supply, demand, market structures', 7, 3, NULL),
(16, 'ECO201', 'Macroeconomics', 'GDP, inflation, monetary policy', 7, 3, 15),
(17, 'BIO101', 'Introduction to Biology', 'Cell biology, genetics and evolution', 8, 4, NULL),
(18, 'BIO201', 'Molecular Biology', 'DNA, RNA, protein synthesis and gene regulation', 8, 4, 17);

-- Students
INSERT INTO students (id, first_name, last_name, email, phone, date_of_birth, gender, address, city, state, zip_code, enrollment_date, status, gpa, department_id, advisor_teacher_id) VALUES
(1, 'Alice', 'Johnson', 'alice.johnson@logixzen.edu', '555-1001', '2002-03-15', 'Female', '123 Oak Street', 'Springfield', 'IL', '62701', '2022-09-01', 'Active', 3.85, 1, 1),
(2, 'Bob', 'Smith', 'bob.smith@logixzen.edu', '555-1002', '2001-07-22', 'Male', '456 Maple Avenue', 'Springfield', 'IL', '62702', '2021-09-01', 'Active', 3.42, 1, 1),
(3, 'Carol', 'Williams', 'carol.williams@logixzen.edu', '555-1003', '2002-11-08', 'Female', '789 Pine Road', 'Springfield', 'IL', '62703', '2022-09-01', 'Active', 3.91, 2, 5),
(4, 'David', 'Brown', 'david.brown@logixzen.edu', '555-1004', '2001-01-30', 'Male', '321 Elm Drive', 'Springfield', 'IL', '62704', '2021-09-01', 'Active', 3.15, 3, 9),
(5, 'Eva', 'Davis', 'eva.davis@logixzen.edu', '555-1005', '2003-05-17', 'Female', '654 Birch Lane', 'Springfield', 'IL', '62705', '2023-09-01', 'Active', 3.78, 1, 1),
(6, 'Frank', 'Miller', 'frank.miller@logixzen.edu', '555-1006', '2002-09-03', 'Male', '987 Cedar Court', 'Springfield', 'IL', '62706', '2022-09-01', 'Active', 2.95, 4, 12),
(7, 'Grace', 'Wilson', 'grace.wilson@logixzen.edu', '555-1007', '2001-12-25', 'Female', '147 Walnut Street', 'Springfield', 'IL', '62707', '2021-09-01', 'Active', 3.67, 2, 5),
(8, 'Henry', 'Moore', 'henry.moore@logixzen.edu', '555-1008', '2002-06-14', 'Male', '258 Spruce Avenue', 'Springfield', 'IL', '62708', '2022-09-01', 'Active', 3.23, 5, 15),
(9, 'Isla', 'Taylor', 'isla.taylor@logixzen.edu', '555-1009', '2003-02-28', 'Female', '369 Ash Boulevard', 'Springfield', 'IL', '62709', '2023-09-01', 'Active', 3.55, 3, 9),
(10, 'Jack', 'Anderson', 'jack.anderson@logixzen.edu', '555-1010', '2001-08-19', 'Male', '741 Poplar Way', 'Springfield', 'IL', '62710', '2021-09-01', 'Graduated', 3.72, 1, 1),
(11, 'Karen', 'Thomas', 'karen.thomas@logixzen.edu', '555-1011', '2002-04-07', 'Female', '852 Willow Path', 'Springfield', 'IL', '62711', '2022-09-01', 'Active', 3.08, 6, NULL),
(12, 'Leo', 'Jackson', 'leo.jackson@logixzen.edu', '555-1012', '2001-10-13', 'Male', '963 Hickory Lane', 'Springfield', 'IL', '62712', '2021-09-01', 'Active', 3.44, 7, 20),
(13, 'Mia', 'White', 'mia.white@logixzen.edu', '555-1013', '2003-01-22', 'Female', '174 Sycamore Drive', 'Springfield', 'IL', '62713', '2023-09-01', 'Active', 3.92, 8, 23),
(14, 'Noah', 'Harris', 'noah.harris@logixzen.edu', '555-1014', '2002-07-05', 'Male', '285 Magnolia Court', 'Springfield', 'IL', '62714', '2022-09-01', 'Active', 2.88, 4, 12),
(15, 'Olivia', 'Martin', 'olivia.martin@logixzen.edu', '555-1015', '2001-03-30', 'Female', '396 Dogwood Street', 'Springfield', 'IL', '62715', '2021-09-01', 'Active', 3.61, 2, 5),
(16, 'Paul', 'Garcia', 'paul.garcia@logixzen.edu', '555-1016', '2002-12-11', 'Male', '507 Redwood Avenue', 'Springfield', 'IL', '62716', '2022-09-01', 'Suspended', 2.10, 1, 1),
(17, 'Quinn', 'Martinez', 'quinn.martinez@logixzen.edu', '555-1017', '2003-06-26', 'Other', '618 Sequoia Road', 'Springfield', 'IL', NULL, '2023-09-01', 'Active', 3.38, 3, 9),
(18, 'Rachel', 'Robinson', 'rachel.robinson@logixzen.edu', '555-1018', '2001-05-09', 'Female', '729 Cypress Lane', 'Springfield', 'IL', '62718', '2021-09-01', 'Active', 3.75, 5, 15),
(19, 'Sam', 'Clark', 'sam.clark@logixzen.edu', '555-1019', '2002-08-18', 'Male', '830 Juniper Way', 'Springfield', 'IL', '62719', '2022-09-01', 'Active', 3.02, 6, NULL),
(20, 'Tara', 'Rodriguez', 'tara.rodriguez@logixzen.edu', '555-1020', '2001-11-04', 'Female', '941 Palm Drive', 'Springfield', 'IL', '62720', '2021-09-01', 'Graduated', 3.88, 7, 20),
(21, 'Uma', 'Lewis', 'uma.lewis@logixzen.edu', '555-1021', '2003-03-21', 'Female', '152 Olive Court', 'Springfield', 'IL', '62721', '2023-09-01', 'Active', 3.65, 8, 23),
(22, 'Victor', 'Lee', 'victor.lee@logixzen.edu', '555-1022', '2002-10-07', 'Male', '263 Fig Street', 'Springfield', 'IL', '62722', '2022-09-01', 'Active', 2.75, 1, 1),
(23, 'Wendy', 'Walker', 'wendy.walker@logixzen.edu', '555-1023', '2001-02-14', 'Female', '374 Date Avenue', 'Springfield', 'IL', '62723', '2021-09-01', 'Active', 3.53, 2, 5),
(24, 'Xavier', 'Hall', 'xavier.hall@logixzen.edu', '555-1024', '2002-05-03', 'Male', '485 Mango Road', 'Springfield', 'IL', NULL, '2022-09-01', 'Active', 3.18, 4, 12),
(25, 'Yolanda', 'Allen', 'yolanda.allen@logixzen.edu', '555-1025', '2003-09-16', 'Female', '596 Lemon Lane', 'Springfield', 'IL', '62725', '2023-09-01', 'Active', 3.82, 3, 9),
(26, 'Zack', 'Young', 'zack.young@logixzen.edu', '555-1026', '2001-04-28', 'Male', '607 Apple Court', 'Springfield', 'IL', '62726', '2021-09-01', 'Active', 2.98, 5, 15),
(27, 'Amy', 'Hernandez', 'amy.hernandez@logixzen.edu', '555-1027', '2002-01-09', 'Female', '718 Berry Drive', 'Springfield', 'IL', '62727', '2022-09-01', 'Active', 3.47, 6, 18),
(28, 'Brian', 'King', 'brian.king@logixzen.edu', '555-1028', '2001-07-20', 'Male', '829 Cherry Way', 'Springfield', 'IL', '62728', '2021-09-01', 'Active', 3.33, 7, 20),
(29, 'Chloe', 'Wright', 'chloe.wright@logixzen.edu', '555-1029', '2003-12-02', 'Female', '930 Grape Street', 'Springfield', 'IL', '62729', '2023-09-01', 'Active', 3.71, 8, 23),
(30, 'Dan', 'Lopez', 'dan.lopez@logixzen.edu', '555-1030', '2002-08-25', 'Male', '141 melon Avenue', 'Springfield', 'IL', '62730', '2022-09-01', 'Withdrawn', 2.45, 1, 1);

-- Courses
INSERT INTO courses (id, subject_id, course_number, section, semester, year, teacher_id, room, max_students, enrolled_count, schedule) VALUES
(1, 1, 'CS101', 'A', 'Fall', 2023, 1, 'Tech 101', 35, 32, 'Mon/Wed 9:00-10:15'),
(2, 1, 'CS101', 'B', 'Fall', 2023, 2, 'Tech 102', 35, 30, 'Tue/Thu 10:30-11:45'),
(3, 2, 'CS201', 'A', 'Fall', 2023, 3, 'Tech 201', 30, 28, 'Mon/Wed 11:00-12:15'),
(4, 3, 'CS301', 'A', 'Fall', 2023, 1, 'Tech 301', 25, 22, 'Tue/Thu 14:00-15:15'),
(5, 5, 'MATH101', 'A', 'Fall', 2023, 5, 'Science 101', 40, 38, 'Mon/Wed/Fri 9:00-9:50'),
(6, 5, 'MATH101', 'B', 'Fall', 2023, 6, 'Science 102', 40, 35, 'Tue/Thu 9:00-9:50'),
(7, 6, 'MATH201', 'A', 'Fall', 2023, 7, 'Science 201', 30, 27, 'Mon/Wed 13:00-14:15'),
(8, 8, 'ENG101', 'A', 'Fall', 2023, 9, 'Arts 101', 35, 33, 'Tue/Thu 11:00-12:15'),
(9, 10, 'PHY101', 'A', 'Fall', 2023, 12, 'Science 301', 40, 36, 'Mon/Wed/Fri 10:30-11:20'),
(10, 12, 'CHM101', 'A', 'Fall', 2023, 15, 'Science 302', 35, 31, 'Tue/Thu 13:00-14:15'),
(11, 13, 'HIST101', 'A', 'Fall', 2023, 18, 'Arts 201', 40, 38, 'Mon/Wed 14:00-15:15'),
(12, 15, 'ECO101', 'A', 'Fall', 2023, 20, 'Business 101', 45, 42, 'Tue/Thu 9:00-10:15'),
(13, 17, 'BIO101', 'A', 'Fall', 2023, 23, 'Science 401', 40, 37, 'Mon/Wed/Fri 11:30-12:20'),
(14, 2, 'CS201', 'A', 'Spring', 2024, 3, 'Tech 201', 30, 0, 'Mon/Wed 11:00-12:15'),
(15, 3, 'CS301', 'A', 'Spring', 2024, 1, 'Tech 301', 25, 0, 'Tue/Thu 14:00-15:15'),
(16, 7, 'MATH301', 'A', 'Spring', 2024, 8, 'Science 202', 30, 0, 'Mon/Wed 15:00-16:15'),
(17, 9, 'ENG201', 'A', 'Spring', 2024, 10, 'Arts 102', 25, 0, 'Tue/Thu 14:00-15:15'),
(18, 11, 'PHY201', 'A', 'Spring', 2024, 13, 'Science 303', 30, 0, 'Mon/Wed 13:00-14:15'),
(19, 16, 'ECO201', 'A', 'Spring', 2024, 21, 'Business 102', 40, 0, 'Tue/Thu 10:30-11:45'),
(20, 18, 'BIO201', 'A', 'Spring', 2024, 24, 'Science 402', 25, 0, 'Mon/Wed 10:30-11:45');

-- Update enrolled counts based on actual enrollments
UPDATE courses SET enrolled_count = (
    SELECT COUNT(*) FROM enrollments WHERE enrollments.course_id = courses.id AND enrollments.status IN ('Enrolled', 'In Progress')
);

-- Enrollments
INSERT INTO enrollments (id, student_id, course_id, enrollment_date, grade, grade_points, status, attendance_percentage) VALUES
-- Fall 2023 enrollments
(1, 1, 1, '2023-09-01', 'A', 4.0, 'Completed', 95.5),
(2, 1, 3, '2023-09-01', 'A-', 3.67, 'Completed', 92.0),
(3, 1, 4, '2023-09-01', 'B+', 3.33, 'Completed', 88.0),
(4, 1, 5, '2023-09-01', 'A', 4.0, 'Completed', 97.0),
(5, 2, 1, '2023-09-01', 'B', 3.0, 'Completed', 85.0),
(6, 2, 2, '2023-09-01', 'B+', 3.33, 'Completed', 82.0),
(7, 2, 6, '2023-09-01', 'C+', 2.33, 'Completed', 78.0),
(8, 3, 5, '2023-09-01', 'A+', 4.0, 'Completed', 98.0),
(9, 3, 7, '2023-09-01', 'A', 4.0, 'Completed', 96.0),
(10, 3, 8, '2023-09-01', 'B', 3.0, 'Completed', 90.0),
(11, 4, 8, '2023-09-01', 'B-', 2.67, 'Completed', 80.0),
(12, 4, 11, '2023-09-01', 'A-', 3.67, 'Completed', 91.0),
(13, 5, 1, '2023-09-01', 'A', 4.0, 'Completed', 94.0),
(14, 5, 9, '2023-09-01', 'B+', 3.33, 'Completed', 89.0),
(15, 5, 13, '2023-09-01', 'A-', 3.67, 'Completed', 93.0),
(16, 6, 9, '2023-09-01', 'C', 2.0, 'Completed', 72.0),
(17, 6, 10, '2023-09-01', 'C+', 2.33, 'Completed', 75.0),
(18, 7, 5, '2023-09-01', 'A-', 3.67, 'Completed', 90.0),
(19, 7, 7, '2023-09-01', 'B+', 3.33, 'Completed', 87.0),
(20, 7, 12, '2023-09-01', 'B', 3.0, 'Completed', 85.0),
(21, 8, 10, '2023-09-01', 'B-', 2.67, 'Completed', 83.0),
(22, 8, 11, '2023-09-01', 'C+', 2.33, 'Completed', 79.0),
(23, 9, 8, '2023-09-01', 'A', 4.0, 'Completed', 95.0),
(24, 9, 13, '2023-09-01', 'B+', 3.33, 'Completed', 91.0),
(25, 10, 1, '2023-09-01', 'A', 4.0, 'Completed', 96.0),
(26, 10, 3, '2023-09-01', 'A-', 3.67, 'Completed', 93.0),
(27, 10, 5, '2023-09-01', 'A+', 4.0, 'Completed', 99.0),
(28, 11, 11, '2023-09-01', 'B', 3.0, 'Completed', 84.0),
(29, 11, 12, '2023-09-01', 'C+', 2.33, 'Completed', 77.0),
(30, 12, 12, '2023-09-01', 'B+', 3.33, 'Completed', 88.0),
(31, 12, 13, '2023-09-01', 'A-', 3.67, 'Completed', 92.0),
(32, 13, 13, '2023-09-01', 'A+', 4.0, 'Completed', 98.0),
(33, 13, 5, '2023-09-01', 'A', 4.0, 'Completed', 96.0),
(34, 14, 9, '2023-09-01', 'D+', 1.33, 'Completed', 65.0),
(35, 14, 10, '2023-09-01', 'F', 0.0, 'Completed', 55.0),
(36, 15, 5, '2023-09-01', 'A-', 3.67, 'Completed', 91.0),
(37, 15, 7, '2023-09-01', 'B', 3.0, 'Completed', 86.0),
(38, 15, 8, '2023-09-01', 'B+', 3.33, 'Completed', 89.0),
(39, 16, 1, '2023-09-01', 'F', 0.0, 'Dropped', 40.0),
(40, 16, 5, '2023-09-01', 'D', 1.0, 'Dropped', 50.0),
(41, 17, 8, '2023-09-01', 'A-', 3.67, 'Completed', 90.0),
(42, 17, 11, '2023-09-01', 'B', 3.0, 'Completed', 85.0),
(43, 18, 10, '2023-09-01', 'A', 4.0, 'Completed', 94.0),
(44, 18, 12, '2023-09-01', 'B+', 3.33, 'Completed', 90.0),
(45, 19, 11, '2023-09-01', 'C', 2.0, 'Completed', 76.0),
(46, 19, 13, '2023-09-01', 'B-', 2.67, 'Completed', 81.0),
(47, 20, 12, '2023-09-01', 'A', 4.0, 'Completed', 97.0),
(48, 20, 13, '2023-09-01', 'A-', 3.67, 'Completed', 94.0),
(49, 21, 13, '2023-09-01', 'A', 4.0, 'Completed', 95.0),
(50, 21, 5, '2023-09-01', 'B+', 3.33, 'Completed', 88.0),
(51, 22, 1, '2023-09-01', 'C-', 1.67, 'Completed', 70.0),
(52, 22, 9, '2023-09-01', 'D', 1.0, 'Completed', 62.0),
(53, 23, 5, '2023-09-01', 'B+', 3.33, 'Completed', 87.0),
(54, 23, 7, '2023-09-01', 'B', 3.0, 'Completed', 84.0),
(55, 24, 9, '2023-09-01', 'B-', 2.67, 'Completed', 80.0),
(56, 24, 10, '2023-09-01', 'C+', 2.33, 'Completed', 77.0),
(57, 25, 8, '2023-09-01', 'A', 4.0, 'Completed', 96.0),
(58, 25, 13, '2023-09-01', 'A-', 3.67, 'Completed', 93.0),
(59, 26, 10, '2023-09-01', 'C', 2.0, 'Completed', 74.0),
(60, 26, 11, '2023-09-01', 'D+', 1.33, 'Completed', 68.0),
(61, 27, 11, '2023-09-01', 'B', 3.0, 'Completed', 85.0),
(62, 27, 12, '2023-09-01', 'B-', 2.67, 'Completed', 82.0),
(63, 28, 12, '2023-09-01', 'A-', 3.67, 'Completed', 91.0),
(64, 28, 13, '2023-09-01', 'B+', 3.33, 'Completed', 88.0),
(65, 29, 13, '2023-09-01', 'A', 4.0, 'Completed', 95.0),
(66, 29, 5, '2023-09-01', 'A-', 3.67, 'Completed', 92.0),
(67, 30, 1, '2023-09-01', 'F', 0.0, 'Dropped', 30.0),
-- Spring 2024 current enrollments
(68, 1, 14, '2024-01-15', NULL, NULL, 'In Progress', 78.0),
(69, 1, 15, '2024-01-15', NULL, NULL, 'In Progress', 82.0),
(70, 2, 14, '2024-01-15', NULL, NULL, 'In Progress', 75.0),
(71, 3, 14, '2024-01-15', NULL, NULL, 'In Progress', 90.0),
(72, 3, 16, '2024-01-15', NULL, NULL, 'In Progress', 88.0),
(73, 5, 14, '2024-01-15', NULL, NULL, 'In Progress', 85.0),
(74, 5, 15, '2024-01-15', NULL, NULL, 'In Progress', 80.0),
(75, 7, 16, '2024-01-15', NULL, NULL, 'In Progress', 83.0),
(76, 9, 17, '2024-01-15', NULL, NULL, 'In Progress', 91.0),
(77, 10, 14, '2024-01-15', NULL, NULL, 'In Progress', 87.0),
(78, 10, 15, '2024-01-15', NULL, NULL, 'In Progress', 84.0),
(79, 13, 17, '2024-01-15', NULL, NULL, 'In Progress', 92.0),
(80, 13, 16, '2024-01-15', NULL, NULL, 'In Progress', 89.0),
(81, 15, 16, '2024-01-15', NULL, NULL, 'In Progress', 81.0),
(82, 18, 18, '2024-01-15', NULL, NULL, 'In Progress', 86.0),
(83, 20, 19, '2024-01-15', NULL, NULL, 'In Progress', 90.0),
(84, 21, 20, '2024-01-15', NULL, NULL, 'In Progress', 88.0),
(85, 21, 15, '2024-01-15', NULL, NULL, 'In Progress', 85.0),
(86, 23, 16, '2024-01-15', NULL, NULL, 'In Progress', 82.0),
(87, 25, 17, '2024-01-15', NULL, NULL, 'In Progress', 93.0),
(88, 28, 19, '2024-01-15', NULL, NULL, 'In Progress', 87.0),
(89, 29, 20, '2024-01-15', NULL, NULL, 'In Progress', 90.0);

-- Update course enrolled counts for spring
UPDATE courses SET enrolled_count = (
    SELECT COUNT(*) FROM enrollments WHERE enrollments.course_id = courses.id AND enrollments.status IN ('Enrolled', 'In Progress')
) WHERE id >= 14;

-- Authors
INSERT INTO authors (id, first_name, last_name, bio, nationality, birth_year, death_year) VALUES
(1, 'Harper', 'Lee', 'American novelist, best known for To Kill a Mockingbird', 'American', 1926, 2016),
(2, 'George', 'Orwell', 'English novelist and essayist, known for 1984 and Animal Farm', 'British', 1903, 1950),
(3, 'Jane', 'Austen', 'English novelist known for sense and sensibility, pride and prejudice', 'British', 1775, 1817),
(4, 'William', 'Shakespeare', 'English playwright and poet, widely regarded as the greatest writer', 'British', 1564, 1616),
(5, 'Leo', 'Tolstoy', 'Russian writer, considered one of the greatest authors of all time', 'Russian', 1828, 1910),
(6, 'F. Scott', 'Fitzgerald', 'American novelist, known for The Great Gatsby', 'American', 1896, 1940),
(7, 'Ernest', 'Hemingway', 'American novelist and short story writer, Nobel laureate', 'American', 1899, 1961),
(8, 'Agatha', 'Christie', 'English writer known as the Queen of Crime', 'British', 1890, 1976),
(9, 'Charles', 'Dickens', 'English writer and social critic, created some of literature''s most iconic characters', 'British', 1812, 1870),
(10, 'Mark', 'Twain', 'American writer and humorist, known for Adventures of Huckleberry Finn', 'American', 1835, 1910),
(11, 'Aldous', 'Huxley', 'English writer and philosopher, author of Brave New World', 'British', 1894, 1963),
(12, 'Richard', 'Dawkins', 'British evolutionary biologist, author of The Selfish Gene', 'British', 1941, NULL),
(13, 'Stephen', 'Hawking', 'English theoretical physicist, author of A Brief History of Time', 'British', 1942, 2018),
(14, 'Charles', 'Darwin', 'English naturalist, author of The Origin of Species', 'British', 1809, 1882),
(15, 'James', 'Watson', 'American molecular biologist, co-discoverer of DNA structure', 'American', 1928, NULL),
(16, 'Carl', 'Sagan', 'American astronomer and science communicator, author of Cosmos', 'American', 1934, 1996);

-- Books
INSERT INTO books (id, isbn, title, description, published_year, price, stock, category, subject_id) VALUES
(1, '978-0-06-112008-4', 'To Kill a Mockingbird', 'A novel about racial injustice in the Deep South', 1960, 12.99, 15, 'Fiction', 9),
(2, '978-0-452-28423-4', '1984', 'A dystopian novel about totalitarian surveillance', 1949, 11.99, 22, 'Fiction', 9),
(3, '978-0-14-143951-8', 'Pride and Prejudice', 'A romantic novel of manners', 1813, 9.99, 18, 'Fiction', 9),
(4, '978-0-7432-7356-5', 'The Great Gatsby', 'A story of wealth and decadence in the Jazz Age', 1925, 10.99, 20, 'Fiction', 9),
(5, '978-0-684-80122-3', 'A Farewell to Arms', 'A novel about love during World War I', 1929, 11.49, 12, 'Fiction', 9),
(6, '978-0-06-093546-7', 'To Kill a Mockingbird Study Guide', 'An academic companion to Lee''s novel', 2001, 15.99, 8, 'Academic', 9),
(7, '978-0-14-044913-6', 'Crime and Punishment', 'A psychological novel about guilt and redemption', 1866, 13.99, 14, 'Fiction', 9),
(8, '978-0-06-112009-1', '1984 Study Guide', 'Critical analysis of Orwell''s masterpiece', 2003, 14.99, 6, 'Academic', 9),
(9, '978-0-316-76948-0', 'The Catcher in the Rye', 'A novel about teenage alienation', 1951, 10.49, 16, 'Fiction', 9),
(10, '978-0-14-144115-3', 'Emma', 'A comic novel of youthful hubris and matchmaking', 1815, 9.49, 10, 'Fiction', 9),
(11, '978-0-451-52493-5', 'Animal Farm', 'An allegorical novella about Soviet totalitarianism', 1945, 8.99, 25, 'Fiction', 9),
(12, '978-0-06-093547-4', 'Brave New World', 'A dystopian novel about a technologically advanced future', 1932, 12.49, 19, 'Fiction', 9),
(13, '978-0-14-028329-7', 'Great Expectations', 'A coming-of-age novel by Charles Dickens', 1861, 10.99, 11, 'Fiction', 9),
(14, '978-0-06-112010-7', 'Adventures of Huckleberry Finn', 'A novel about a boy''s journey down the Mississippi', 1884, 11.49, 13, 'Fiction', 9),
(15, '978-0-14-144116-0', 'Sense and Sensibility', 'A novel about two sisters and their different approaches to love', 1811, 9.99, 9, 'Fiction', 9),
(16, '978-0-393-97024-8', 'The Selfish Gene', 'A book popularizing individual-centered selection', 1976, 16.99, 7, 'Science', 17),
(17, '978-0-393-35434-2', 'A Brief History of Time', 'An exploration of cosmology by Stephen Hawking', 1988, 18.99, 10, 'Science', 10),
(18, '978-0-393-60977-5', 'The Origin of Species', 'Darwin''s foundational work on evolutionary biology', 1859, 14.99, 5, 'Science', 17),
(19, '978-0-393-73455-4', 'The Double Helix', 'A personal account of the discovery of DNA structure', 1968, 13.99, 8, 'Science', 18),
(20, '978-0-393-35244-7', 'Cosmos', 'A bestselling science book by Carl Sagan', 1980, 17.99, 12, 'Science', 10);

-- Book-author relationships (many-to-many)
INSERT INTO book_authors (book_id, author_id) VALUES
(1, 1), (2, 2), (3, 3), (4, 6), (5, 7),
(6, 1), (7, 5), (8, 2), (9, 6), (10, 3),
(11, 2), (12, 11), (13, 9), (14, 10), (15, 3),
(16, 12), (17, 13), (18, 14), (19, 15), (20, 16);

-- Loans
INSERT INTO loans (id, student_id, book_id, loan_date, due_date, return_date, fine, status) VALUES
(1, 1, 1, '2023-10-01', '2023-10-15', '2023-10-14', 0.0, 'Returned'),
(2, 1, 3, '2023-10-01', '2023-10-15', '2023-10-20', 1.0, 'Returned'),
(3, 2, 2, '2023-10-05', '2023-10-19', '2023-10-18', 0.0, 'Returned'),
(4, 2, 11, '2023-10-05', '2023-10-19', '2023-11-01', 5.0, 'Returned'),
(5, 3, 4, '2023-11-01', '2023-11-15', '2023-11-14', 0.0, 'Returned'),
(6, 3, 16, '2023-11-01', '2023-11-15', '2023-11-15', 0.0, 'Returned'),
(7, 5, 1, '2023-11-10', '2023-11-24', '2023-11-23', 0.0, 'Returned'),
(8, 5, 9, '2023-11-10', '2023-11-24', '2023-12-01', 3.0, 'Returned'),
(9, 7, 3, '2023-12-01', '2023-12-15', '2023-12-14', 0.0, 'Returned'),
(10, 7, 7, '2023-12-01', '2023-12-15', '2023-12-18', 1.0, 'Returned'),
(11, 9, 5, '2023-12-10', '2023-12-24', '2023-12-22', 0.0, 'Returned'),
(12, 10, 2, '2023-12-15', '2024-01-05', '2024-01-04', 0.0, 'Returned'),
(13, 13, 18, '2024-01-10', '2024-01-24', NULL, 0.0, 'Active'),
(14, 13, 19, '2024-01-10', '2024-01-24', NULL, 0.0, 'Active'),
(15, 21, 16, '2024-01-15', '2024-01-29', NULL, 0.0, 'Active'),
(16, 25, 17, '2024-01-15', '2024-01-29', NULL, 0.0, 'Active'),
(17, 29, 20, '2024-01-20', '2024-02-03', NULL, 0.0, 'Active'),
(18, 6, 11, '2024-01-20', '2024-02-03', '2024-02-10', 3.5, 'Returned'),
(19, 14, 9, '2024-01-22', '2024-02-05', NULL, 0.0, 'Active'),
(20, 22, 14, '2024-01-25', '2024-02-08', '2024-02-15', 3.5, 'Returned');

-- Exams
INSERT INTO exams (id, course_id, exam_number, title, exam_date, total_marks, duration_minutes, exam_type) VALUES
(1, 1, 1, 'Midterm Exam', '2023-10-15', 100.0, 90, 'Midterm'),
(2, 1, 2, 'Final Exam', '2023-12-12', 100.0, 120, 'Final'),
(3, 2, 1, 'Midterm Exam', '2023-10-16', 100.0, 90, 'Midterm'),
(4, 2, 2, 'Final Exam', '2023-12-13', 100.0, 120, 'Final'),
(5, 3, 1, 'Quiz 1', '2023-09-20', 50.0, 30, 'Quiz'),
(6, 3, 2, 'Quiz 2', '2023-10-18', 50.0, 30, 'Quiz'),
(7, 3, 3, 'Midterm Exam', '2023-10-25', 100.0, 90, 'Midterm'),
(8, 3, 4, 'Final Exam', '2023-12-14', 100.0, 120, 'Final'),
(9, 5, 1, 'Midterm Exam', '2023-10-16', 100.0, 90, 'Midterm'),
(10, 5, 2, 'Final Exam', '2023-12-14', 100.0, 120, 'Final'),
(11, 8, 1, 'Essay Exam', '2023-11-01', 100.0, 60, 'Project'),
(12, 9, 1, 'Midterm Exam', '2023-10-17', 100.0, 90, 'Midterm'),
(13, 9, 2, 'Final Exam', '2023-12-15', 100.0, 120, 'Final'),
(14, 10, 1, 'Lab Report', '2023-11-15', 100.0, 0, 'Lab'),
(15, 10, 2, 'Final Exam', '2023-12-15', 100.0, 120, 'Final'),
(16, 11, 1, 'Midterm Exam', '2023-10-18', 100.0, 90, 'Midterm'),
(17, 11, 2, 'Final Exam', '2023-12-16', 100.0, 120, 'Final'),
(18, 12, 1, 'Midterm Exam', '2023-10-19', 100.0, 90, 'Midterm'),
(19, 12, 2, 'Final Exam', '2023-12-16', 100.0, 120, 'Final'),
(20, 13, 1, 'Midterm Exam', '2023-10-20', 100.0, 90, 'Midterm');

-- Exam results
INSERT INTO exam_results (id, exam_id, student_id, marks_obtained, submitted_at) VALUES
-- CS101 Midterm (exam 1)
(1, 1, 1, 88.0, '2023-10-15 14:30:00'),
(2, 1, 2, 72.0, '2023-10-15 14:25:00'),
(3, 1, 5, 91.0, '2023-10-15 14:35:00'),
(4, 1, 10, 95.0, '2023-10-15 14:28:00'),
(5, 1, 16, 35.0, '2023-10-15 14:20:00'),
(6, 1, 22, 55.0, '2023-10-15 14:32:00'),
(7, 1, 30, 28.0, '2023-10-15 14:15:00'),
-- CS101 Final (exam 2)
(8, 2, 1, 92.0, '2023-12-12 10:00:00'),
(9, 2, 2, 78.0, '2023-12-12 10:05:00'),
(10, 2, 5, 89.0, '2023-12-12 09:55:00'),
(11, 2, 10, 94.0, '2023-12-12 10:02:00'),
(12, 2, 16, 30.0, '2023-12-12 10:10:00'),
(13, 2, 22, 60.0, '2023-12-12 10:08:00'),
-- CS201 Midterm (exam 3)
(14, 3, 1, 85.0, '2023-10-16 14:30:00'),
(15, 3, 2, 70.0, '2023-10-16 14:25:00'),
(16, 3, 5, 88.0, '2023-10-16 14:35:00'),
(17, 3, 10, 92.0, '2023-10-16 14:28:00'),
-- CS201 Final (exam 4)
(18, 4, 1, 90.0, '2023-12-13 10:00:00'),
(19, 4, 2, 75.0, '2023-12-13 10:05:00'),
(20, 4, 5, 87.0, '2023-12-13 09:55:00'),
(21, 4, 10, 93.0, '2023-12-13 10:02:00'),
-- CS301 Quiz 1 (exam 5)
(22, 5, 1, 45.0, '2023-09-20 11:00:00'),
(23, 5, 2, 38.0, '2023-09-20 11:00:00'),
(24, 5, 5, 47.0, '2023-09-20 11:00:00'),
(25, 5, 10, 49.0, '2023-09-20 11:00:00'),
-- CS301 Quiz 2 (exam 6)
(26, 6, 1, 48.0, '2023-10-18 11:00:00'),
(27, 6, 2, 42.0, '2023-10-18 11:00:00'),
(28, 6, 5, 46.0, '2023-10-18 11:00:00'),
-- CalcuMidterm (exam 9)
(29, 9, 3, 96.0, '2023-10-16 14:30:00'),
(30, 9, 7, 88.0, '2023-10-16 14:25:00'),
(31, 9, 15, 85.0, '2023-10-16 14:35:00'),
(32, 9, 23, 82.0, '2023-10-16 14:28:00'),
(33, 9, 26, 70.0, '2023-10-16 14:20:00'),
(34, 9, 8, 94.0, '2023-10-16 14:32:00'),
-- Calculus Final (exam 10)
(35, 10, 3, 98.0, '2023-12-14 10:00:00'),
(36, 10, 7, 90.0, '2023-12-14 10:05:00'),
(37, 10, 15, 87.0, '2023-12-14 09:55:00'),
(38, 10, 23, 84.0, '2023-12-14 10:02:00'),
(39, 10, 26, 72.0, '2023-12-14 10:10:00'),
(40, 10, 10, 95.0, '2023-12-14 10:08:00'),
-- Physics Midterm (exam 12)
(41, 12, 5, 82.0, '2023-10-17 14:30:00'),
(42, 12, 6, 65.0, '2023-10-17 14:25:00'),
(43, 12, 14, 58.0, '2023-10-17 14:35:00'),
(44, 12, 18, 90.0, '2023-10-17 14:28:00'),
(45, 12, 24, 72.0, '2023-10-17 14:20:00'),
-- Physics Final (exam 13)
(46, 13, 5, 85.0, '2023-12-15 10:00:00'),
(47, 13, 6, 68.0, '2023-12-15 10:05:00'),
(48, 13, 14, 55.0, '2023-12-15 09:55:00'),
(49, 13, 18, 92.0, '2023-12-15 10:02:00'),
(50, 13, 24, 75.0, '2023-12-15 10:10:00');

-- Scholarships
INSERT INTO scholarships (id, name, description, amount, GPA_requirement, min_age, max_age, department_id, active) VALUES
(1, 'Merit Scholarship', 'For students with outstanding academic performance', 5000.00, 3.5, 18, 25, NULL, 1),
(2, 'Need-Based Grant', 'Financial assistance for students demonstrating need', 3000.00, 2.0, 18, 30, NULL, 1),
(3, 'CS Department Award', 'Exclusive to Computer Science majors', 2500.00, 3.0, 18, 25, 1, 1),
(4, 'STEM Scholarship', 'For students pursuing science or mathematics', 4000.00, 3.2, 18, 25, NULL, 1),
(5, 'Athletic Excellence', 'For student athletes maintaining good grades', 3500.00, 2.5, 18, 25, NULL, 1),
(6, 'First-Generation College', 'Support for first-generation college students', 2000.00, 2.0, 18, 25, NULL, 1),
(7, 'Engineering Innovator', 'For creative problem-solving in engineering', 3000.00, 3.0, 18, 25, 1, 1),
(8, 'Humanities Fellowship', 'For excellence in literature and languages', 2500.00, 3.0, 18, 25, 3, 1),
(9, 'Research Assistantship', 'For students assisting faculty research', 4000.00, 3.3, 19, 25, NULL, 1),
(10, 'Dean''s List Bonus', 'Additional support for Dean''s List students', 1500.00, 3.7, 18, 25, NULL, 1);

-- Student scholarships
INSERT INTO student_scholarships (student_id, scholarship_id, awarded_date, amount_awarded) VALUES
(1, 1, '2023-09-01', 5000.00),
(1, 3, '2023-09-01', 2500.00),
(3, 1, '2023-09-01', 5000.00),
(3, 4, '2023-09-01', 4000.00),
(5, 1, '2023-09-01', 5000.00),
(7, 4, '2023-09-01', 4000.00),
(9, 1, '2023-09-01', 5000.00),
(10, 1, '2023-09-01', 5000.00),
(10, 3, '2023-09-01', 2500.00),
(13, 1, '2023-09-01', 5000.00),
(13, 4, '2023-09-01', 4000.00),
(15, 4, '2023-09-01', 4000.00),
(18, 4, '2023-09-01', 4000.00),
(20, 1, '2023-09-01', 5000.00),
(21, 4, '2023-09-01', 4000.00),
(25, 1, '2023-09-01', 5000.00),
(28, 4, '2023-09-01', 4000.00),
(29, 1, '2023-09-01', 5000.00),
(2, 2, '2023-09-01', 3000.00),
(6, 2, '2023-09-01', 3000.00),
(11, 6, '2023-09-01', 2000.00),
(14, 2, '2023-09-01', 3000.00),
(16, 2, '2023-09-01', 3000.00),
(19, 6, '2023-09-01', 2000.00),
(22, 2, '2023-09-01', 3000.00),
(26, 2, '2023-09-01', 3000.00),
(30, 6, '2023-09-01', 2000.00);
