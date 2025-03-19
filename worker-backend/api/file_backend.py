import boto3
from django.conf import settings
from botocore.exceptions import NoCredentialsError, PartialCredentialsError, ClientError


class S3Client:

    def __init__(self, bucket_name=None):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        self.bucket_name = bucket_name if bucket_name is not None else settings.AWS_STORAGE_BUCKET_NAME
        self.expires_in=settings.AWS_QUERYSTRING_EXPIRE


    def upload_file(self, file_path, object_name, metadata=None):
        try:
            extra_args = {}
            if metadata is not None:
                extra_args['Metadata'] = metadata
            self.s3_client.upload_file(file_path, self.bucket_name, object_name, ExtraArgs=extra_args)
            return True
        except (NoCredentialsError, PartialCredentialsError, ClientError) as e:
            print(f"Failed to upload file: {e}")
            return False


    def download_file(self, object_name, file_path):
        try:
            self.s3_client.download_file(self.bucket_name, object_name, file_path)
            return True
        except ClientError as e:
            print(f"Failed to download file: {e}")
            return False


    def get_object_metadata(self, object_name):
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=object_name)
            metadata = response.get('Metadata', {})
            content_type = response.get('ContentType', None) 
            return metadata
        except ClientError as e:
            print(f"Failed to get the metadata of the file: {e}")
            return None
    

    def generate_presigned_url_to_get(self, object_name, expiration=None):
        if expiration is None:
            expiration = self.expires_in
        try:
            response = self.s3_client.generate_presigned_url('get_object',
                                                             Params={'Bucket': self.bucket_name, 'Key': object_name},
                                                             ExpiresIn=int(expiration))
            return response
        except ClientError as e:
            print(f"Failed to generate presigned URL: {e}")
            return None


    def generate_presigned_url_to_upload(self, object_name, content_type="application/octet-stream", expiration=None, metadata=None,):
        params={'Bucket': self.bucket_name, 'Key': object_name, 'ContentType': content_type}
        if expiration is None:
            expiration = self.expires_in
        if metadata is not None:
            params['Metadata'] = metadata
        try:
            response = self.s3_client.generate_presigned_url('put_object',
                                                             Params=params,
                                                             ExpiresIn=int(expiration),
                                                             HttpMethod='PUT')
            return response
        except ClientError as e:
            print(f"Failed to generate upload presigned URL: {e}")
            return None
    

    def delete_file(self, object_name):
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
            print(f"File deleted successfully: {object_name}")
            return True
        except ClientError as e:
            print(f"Failed to delete file {object_name}: {e}")
            return False