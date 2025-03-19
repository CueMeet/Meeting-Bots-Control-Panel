-- Create meetingbots_db_backend_api database and user
CREATE USER meetingbots_db_backend_api WITH PASSWORD 'meetingbots_db_backend_api';
CREATE DATABASE meetingbots_db_backend_api;
GRANT ALL PRIVILEGES ON DATABASE meetingbots_db_backend_api TO meetingbots_db_backend_api;

-- Create meetingbots_db_worker database and user
CREATE USER meetingbots_db_worker WITH PASSWORD 'meetingbots_db_worker';
CREATE DATABASE meetingbots_db_worker;
GRANT ALL PRIVILEGES ON DATABASE meetingbots_db_worker TO meetingbots_db_worker;