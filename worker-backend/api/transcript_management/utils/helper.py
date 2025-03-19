
def get_meta_data(file_key: str, s3_client):
    metadata = s3_client.get_object_metadata(file_key)

    if not metadata:
        raise Exception("Failed to get metadata for the file")
    
    user_id = metadata.get('user_id') if metadata.get('user_id') not in (None, "None", "") else None
    bot_type = metadata.get('bot_type') if metadata.get('bot_type') not in (None, "None", "") else None
    execution_id = metadata.get('id') if metadata.get('id') not in (None, "None", "") else None
    meeting_title = metadata.get('meeting_title') if metadata.get('meeting_title') not in (None, "None", "") else None

    if not user_id or not bot_type or not execution_id:
        raise Exception("Failed to get metadata for the file, missing required fields")
    
    return user_id, bot_type, execution_id, meeting_title

